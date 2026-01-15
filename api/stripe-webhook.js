import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";
import admin from "firebase-admin";

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  const jsonStr = b64
    ? Buffer.from(b64, "base64").toString("utf8")
    : raw;

  if (!jsonStr) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or _B64");
  }

  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(jsonStr)),
  });
}

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false }, // IMPORTANT for Stripe signature verification
};

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function confirmationCode(sessionId) {
  const salt = process.env.ORDER_CODE_SALT;
  const hex = crypto.createHash("sha256").update(sessionId + salt).digest("hex");
  return "CCS-" + hex.slice(0, 8).toUpperCase();
}

function formatAddress(addr) {
  if (!addr) return "(no address)";
  const lines = [
    addr.line1,
    addr.line2,
    [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", "),
    addr.country,
  ].filter(Boolean);
  return lines.join("\n");
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

initFirebaseAdmin();
const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      // ----- Idempotency guard (no DB): use PaymentIntent metadata -----
      const paymentIntentId = session.payment_intent;
      if (paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (pi.metadata?.receipt_sent === "1") {
          console.log("Receipt already sent for PI:", paymentIntentId);
          return res.status(200).json({ received: true, skipped: "already_sent" });
        }
      } else {
        console.log("No payment_intent on session; cannot do metadata idempotency.");
      }

      const customerEmail = session.customer_details?.email || null;
      const shipName =
        session.shipping_details?.name ||
        session.customer_details?.name ||
        "(no name)";
      const shipPhone =
        session.shipping_details?.phone || session.customer_details?.phone || "N/A";
      const addr =
        session.shipping_details?.address || session.customer_details?.address || null;
      const shipAddress = formatAddress(addr);
      const amount = session.amount_total
        ? (session.amount_total / 100).toFixed(2)
        : "0.00";

      // ----- Load line items + expand product so we can read product.metadata.soapId -----
      let itemsText = "(could not load line items)";
      let orderItems = [];

      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ["data.price.product"],
        });

        orderItems = (lineItems.data || [])
          .map((item) => {
            const qty = item.quantity || 0;
            const soapId = item.price?.product?.metadata?.soapId;
            return { soapId, qty, description: item.description || "" };
          })
          .filter((it) => it.soapId && it.qty > 0);

        itemsText = (lineItems.data || [])
          .map((item) => `${item.description} × ${item.quantity}`)
          .join("\n");
      } catch (err) {
        console.error("Webhook processing failed:", err);
        return res.status(500).send("Webhook failed");
      }


      const code = confirmationCode(session.id);

      // ----- Write Firestore order AFTER successful payment -----

      // ----- Write Firestore order AFTER successful payment (idempotent + atomic) -----
      const orderRef = db.collection("orders").doc(session.id);

      const shipping = {
        name: shipName,
        phone: shipPhone,
        address1: addr?.line1 || "",
        address2: addr?.line2 || "",
        city: addr?.city || "",
        state: addr?.state || "",
        zip: addr?.postal_code || "",
        country: addr?.country || "",
      };
      await db.runTransaction(async (tx) => {
        // --- READS FIRST ---
        const orderSnap = await tx.get(orderRef);
        const alreadyApplied = orderSnap.exists && orderSnap.data()?.stockApplied === true;
        if (alreadyApplied) return;

        // Collect refs + do ALL reads up front
        const items = orderItems
          .map((it) => ({
            soapId: it.soapId,
            qty: Number(it.qty || 0),
            soapRef: it.soapId ? db.doc(`soaps/${it.soapId}`) : null,
          }))
          .filter((it) => it.soapRef && it.qty > 0);

        const soapSnaps = await Promise.all(items.map((it) => tx.get(it.soapRef)));

        // Validate stock (still no writes)
        for (let i = 0; i < items.length; i++) {
          const { soapId, qty } = items[i];
          const snap = soapSnaps[i];
          const stock = Number(snap.data()?.stock ?? 0);
          if (qty > stock) {
            throw new Error(`Insufficient stock for ${soapId}. Have ${stock}, need ${qty}`);
          }
        }

        // --- WRITES AFTER ALL READS ---
        for (let i = 0; i < items.length; i++) {
          const { soapRef, qty } = items[i];
          const snap = soapSnaps[i];
          const stock = Number(snap.data()?.stock ?? 0);
          tx.update(soapRef, { stock: stock - qty });
        }

        tx.set(
          orderRef,
          {
            status: "paid",
            stripeSessionId: session.id,
            paymentIntentId: paymentIntentId || null,
            confirmationCode: code,
            customerEmail,
            shipping,
            items: orderItems.map(({ soapId, qty }) => ({ soapId, qty })),
            trackingNumber: null,
            shippedAt: null,
            deliveredAt: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            stockApplied: true,
            stockAppliedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      // ----- Emails -----
      const ownerMessage = [
        "NEW ORDER",
        "",
        `Confirmation Code: ${code}`,
        `Session: ${session.id}`,
        "",
        `Email: ${customerEmail || "(no email)"}`,
        "",
        "Items:",
        itemsText,
        "",
        `Total: $${amount}`,
        "",
        "Ship To:",
        shipName,
        shipAddress,
        "",
        `Phone: ${shipPhone}`,
      ].join("\n");

      const customerMessage = [
        "Thank you for your order from Cute Clean Soaps!",
        "",
        `Confirmation Code: ${code}`,
        "",
        "Items:",
        itemsText,
        "",
        `Total: $${amount}`,
        "",
        "Shipping To:",
        shipName,
        shipAddress,
        "",
        "If you have any questions, reply to support@cutecleansoaps.com.",
        "",
        "— Cute Clean Soaps",
      ].join("\n");

      const resend = new Resend(process.env.RESEND_API_KEY);

      const ownerResult = await resend.emails.send({
        from: process.env.RESEND_FROM,
        to: process.env.ORDER_EMAILS.split(",").map((s) => s.trim()),
        subject: "New Soap Order",
        text: ownerMessage,
      });
      console.log("Owner email result:", ownerResult);

      if (customerEmail) {
        const customerResult = await resend.emails.send({
          from: process.env.RESEND_FROM,
          to: [customerEmail],
          subject: `Thanks for your order! (${code})`,
          text: customerMessage,
        });
        console.log("Customer receipt email result:", customerResult);
      } else {
        console.log("No customer email found on session.");
      }

      // Mark as sent so retries won't resend
      if (paymentIntentId) {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            ...pi.metadata,
            receipt_sent: "1",
            confirmation_code: code,
          },
        });
        console.log("Marked receipt_sent=1 on PI:", paymentIntentId);
      }
    }
  } catch (err) {
    console.error("Webhook processing failed:", err);
  }

  return res.status(200).json({ received: true });
}
