import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";
import admin from "firebase-admin";

/* =========================
   Firebase Admin
========================= */
function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const jsonStr = b64 ? Buffer.from(b64, "base64").toString("utf8") : raw;

  if (!jsonStr) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or _B64");
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(jsonStr)),
  });
}

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false }, // REQUIRED for Stripe
};

initFirebaseAdmin();
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* =========================
   Helpers
========================= */
function confirmationCode(sessionId) {
  const salt = process.env.ORDER_CODE_SALT || "";
  const hex = crypto.createHash("sha256").update(sessionId + salt).digest("hex");
  return "CCS-" + hex.slice(0, 8).toUpperCase();
}

function formatAddress(addr) {
  if (!addr) return "(no address)";
  return [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ]
    .filter(Boolean)
    .join("\n");
}

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/* =========================
   Webhook Handler
========================= */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  /* ---- Verify Stripe signature ---- */
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("WEBHOOK VERSION: LOCKS_V3", process.env.VERCEL_URL);

  } catch (err) {
    console.error("Stripe signature failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const paymentIntentId = session.payment_intent || null;

  console.log("WEBHOOK HIT", {
    eventId: event.id,
    sessionId: session.id,
    pi: paymentIntentId,
  });

  /* =========================
     Load Line Items (deduped)
  ========================= */
  let orderItems = [];
  let itemsText = "";

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    expand: ["data.price.product"],
  });

  const qtyBySoap = new Map();

  for (const item of lineItems.data || []) {
    const soapId = item.price?.product?.metadata?.soapId;
    const qty = Number(item.quantity || 0);
    if (!soapId || qty <= 0) continue;
    qtyBySoap.set(soapId, (qtyBySoap.get(soapId) || 0) + qty);
  }

  orderItems = Array.from(qtyBySoap.entries()).map(([soapId, qty]) => ({
    soapId,
    qty,
  }));

  itemsText = (lineItems.data || [])
    .map((i) => `${i.description} × ${i.quantity}`)
    .join("\n");

  console.log("orderItems (deduped):", orderItems);

  /* =========================
     Idempotent Firestore TX
  ========================= */
  const orderRef = db.collection("orders").doc(session.id);

  // TWO locks: session + payment intent
  const sessionLockRef = db.collection("webhookLocks").doc(session.id);
  const piLockRef = paymentIntentId
    ? db.collection("webhookLocks").doc(paymentIntentId)
    : null;

  const customerEmail = session.customer_details?.email || null;
  const addr =
    session.shipping_details?.address ||
    session.customer_details?.address ||
    null;

  const shipping = {
    name:
      session.shipping_details?.name ||
      session.customer_details?.name ||
      "(no name)",
    phone:
      session.shipping_details?.phone ||
      session.customer_details?.phone ||
      "N/A",
    address1: addr?.line1 || "",
    address2: addr?.line2 || "",
    city: addr?.city || "",
    state: addr?.state || "",
    zip: addr?.postal_code || "",
    country: addr?.country || "",
  };

  const code = confirmationCode(session.id);
  let applied = false;

  await db.runTransaction(async (tx) => {
    const sessionLockSnap = await tx.get(sessionLockRef);
    const piLockSnap = piLockRef ? await tx.get(piLockRef) : null;

    // 🔒 HARD STOP if already processed
    if (sessionLockSnap.exists || (piLockSnap && piLockSnap.exists)) {
      return;
    }

    // Read all soap docs FIRST
    const items = orderItems.map((it) => ({
      ...it,
      ref: db.doc(`soaps/${it.soapId}`),
    }));

    const soapSnaps = await Promise.all(items.map((i) => tx.get(i.ref)));

    // Validate stock
    for (let i = 0; i < items.length; i++) {
      const stock = Number(soapSnaps[i].data()?.stock ?? 0);
      if (items[i].qty > stock) {
        throw new Error(`Insufficient stock for ${items[i].soapId}`);
      }
    }

    // Create BOTH locks
    tx.create(sessionLockRef, {
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      eventId: event.id,
      sessionId: session.id,
      paymentIntentId,
    });

    if (piLockRef) {
      tx.create(piLockRef, {
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        eventId: event.id,
        sessionId: session.id,
        paymentIntentId,
      });
    }

    // Decrement stock ONCE
    for (let i = 0; i < items.length; i++) {
      const stock = Number(soapSnaps[i].data()?.stock ?? 0);
      tx.update(items[i].ref, { stock: stock - items[i].qty });
    }

    // Write order
    tx.set(
      orderRef,
      {
        status: "paid",
        stripeSessionId: session.id,
        paymentIntentId,
        confirmationCode: code,
        customerEmail,
        shipping,
        items: orderItems,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    applied = true;
  });

  if (!applied) {
    console.log("Skipping already-processed order:", session.id);
    return res.status(200).json({ received: true, skipped: true });
  }

  /* =========================
     Emails (ONLY once)
  ========================= */
  const resend = new Resend(process.env.RESEND_API_KEY);

  const ownerMessage = [
    "NEW ORDER",
    "",
    `Confirmation Code: ${code}`,
    "",
    itemsText,
    "",
    shipping.name,
    formatAddress(addr),
  ].join("\n");

  await resend.emails.send({
    from: process.env.RESEND_FROM,
    to: process.env.ORDER_EMAILS.split(",").map((e) => e.trim()),
    subject: "New Soap Order",
    text: ownerMessage,
  });

  if (customerEmail) {
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: [customerEmail],
      subject: `Thanks for your order! (${code})`,
      text: ownerMessage,
    });
  }

  return res.status(200).json({ received: true });
}
