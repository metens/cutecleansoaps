import admin from "firebase-admin";
import { Resend } from "resend";

function requireAdmin(req, res) {
    // Prefer Authorization header
    const auth = req.headers.authorization || "";
    const headerToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";

    const token = headerToken;
 
    if (!process.env.ADMIN_TOKEN) {
      res.status(500).json({ error: "Missing ADMIN_TOKEN env var" });
      return false;
    }
    if (!token || token !== process.env.ADMIN_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    return true;
  }
  
  function initFirebaseAdmin() {
    if (admin.apps.length) return;
  
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_JSON_B64;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  
    const jsonStr = b64
      ? Buffer.from(b64, "base64").toString("utf8")
      : raw;
  
    if (!jsonStr) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON(_B64)");
  
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(jsonStr)),
    });
  }

const ALLOWED_STATUSES = new Set(["paid", "packing", "shipped", "delivered", "canceled"]);

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    initFirebaseAdmin();
    const db = admin.firestore();

    const { orderId, status, trackingNumber } = req.body || {};

    if (!orderId || typeof orderId !== "string") {
      return res.status(400).json({ error: "Missing orderId" });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Read current order (for customerEmail + “send only once” logic)
    const ref = db.collection("orders").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Order not found" });

    const order = snap.data() || {};
    const prevTracking = (order.trackingNumber || "").trim();
    const nextTracking = (trackingNumber || "").trim();
    const customerEmail = order.customerEmail || null;

    const updates = {
      status,
      trackingNumber: nextTracking || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (status === "shipped") {
        const t = String(trackingNumber || "").trim();
        if (!t) return res.status(400).json({ error: "Tracking number required for shipped" });
        if (t.length < 8 || t.length > 40) {
          return res.status(400).json({ error: "Tracking number looks invalid" });
        }
      }
    if (status === "shipped") updates.shippedAt = admin.firestore.FieldValue.serverTimestamp();
    if (status === "delivered") updates.deliveredAt = admin.firestore.FieldValue.serverTimestamp();

    await ref.set(updates, { merge: true });

    // ---- Email customer when tracking is newly added OR status becomes shipped ----
    const shippingEmailAlreadySent = !!order.shippingEmailSentAt;
    const trackingJustAdded = !prevTracking && !!nextTracking;
    const becameShipped = order.status !== "shipped" && status === "shipped";

    if (
      customerEmail &&
      !shippingEmailAlreadySent &&
      (trackingJustAdded || becameShipped) &&
      nextTracking
    ) {
      if (!process.env.RESEND_API_KEY) throw new Error("Missing RESEND_API_KEY");

      const resend = new Resend(process.env.RESEND_API_KEY);
      const code = order.confirmationCode || orderId;
      const trackingUrl = `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(nextTracking)}`;

      const msg = [
        "Your order has shipped! 🚚",
        "",
        `Order: ${code}`,
        `Tracking number: ${nextTracking}`,
        `Track it: ${trackingUrl}`,
        "",
        "— Cute Clean Soaps",
      ].join("\n");

      await resend.emails.send({
        from: process.env.RESEND_FROM || "Cute Clean Soaps <orders@cutecleansoaps.com>",
        to: [customerEmail],
        reply_to: "orders@cutecleansoaps.com", // or your real support email
        subject: `Your order shipped (${code})`,
        text: msg,
      });

      await ref.set(
        { shippingEmailSentAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin-update-order error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
