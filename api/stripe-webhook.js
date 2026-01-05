import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function confirmationCode(sessionId) {
  const salt = process.env.ORDER_CODE_SALT || "ccs_default_salt_change_me";
  const hex = crypto.createHash("sha256").update(sessionId + salt).digest("hex");
  return "CCS-" + hex.slice(0, 8).toUpperCase();
}

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const rawBody = await new Promise((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Always ack Stripe, even if our processing fails (prevents endless retries)
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      const email = session.customer_details?.email || "(no email)";

      // Prefer shipping_details, but fallback to customer_details
      const shipName =
        session.shipping_details?.name ||
        session.customer_details?.name ||
        "(no name)";

      const shipPhone =
        session.shipping_details?.phone ||
        session.customer_details?.phone ||
        "N/A";

      const addr =
        session.shipping_details?.address ||
        session.customer_details?.address ||
        null;

      const shipAddress = addr
        ? `${addr.line1 || ""}
        ${addr.line2 || ""}
        ${addr.city || ""}, ${addr.state || ""} ${addr.postal_code || ""}
        ${addr.country || ""}`.trim()
        : "(no address)";


      const shipping = session.shipping_details || null;
      const address = shipping?.address || {};

      const amount = session.amount_total
        ? (session.amount_total / 100).toFixed(2)
        : "0.00";

      // Line items can fail sometimes; don’t crash the webhook
      let itemsText = "(could not load line items)";
      try {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        itemsText = lineItems.data
          .map((item) => `${item.description} × ${item.quantity}`)
          .join("\n");
      } catch (e) {
        console.error("listLineItems failed:", e);
      }

      const code = confirmationCode(session.id);
      const message = `
      NEW ORDER 🧼
      
      Confirmation Code: ${code}
      Session: ${session.id}
      
      Email: ${email}
      
      Items:
      ${itemsText}
      
      Total: $${amount}
      
      Ship To:
      ${shipName}
      ${shipAddress}
      
      Phone: ${shipPhone}
      `.trim();


      const resend = new Resend(process.env.RESEND_API_KEY);

      // Testing:
      console.log("Webhook hit, type:", event.type);
      console.log("ORDER_EMAILS:", process.env.ORDER_EMAILS ? "set" : "MISSING");
      console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY ? "set" : "MISSING");

      await resend.emails.send({
        from: "Cute Clean Soaps <orders@cutecleansoaps.com>",
        to: process.env.ORDER_EMAILS.split(",").map(s => s.trim()),
        subject: "🧼 New Soap Order",
        text: message,
      });

      console.log("Resend result:", result);

    }
  } catch (err) {
    console.error("Webhook processing failed:", err);
  }

  return res.status(200).json({ received: true });
}
