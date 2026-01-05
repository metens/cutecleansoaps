import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function confirmationCode(sessionId) {
  const salt = process.env.ORDER_CODE_SALT || "ccs_default_salt_change_me";
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
        session.shipping_details?.phone ||
        session.customer_details?.phone ||
        "N/A";

      const addr =
        session.shipping_details?.address ||
        session.customer_details?.address ||
        null;

      const shipAddress = formatAddress(addr);

      const amount = session.amount_total
        ? (session.amount_total / 100).toFixed(2)
        : "0.00";

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

      const ownerMessage = [
        "NEW ORDER 🧼",
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
        "Thank you for your order from Cute Clean Soaps! 🧼💛",
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
        "If you have any questions, reply to this email.",
        "",
        "— Cute Clean Soaps",
      ].join("\n");

      const resend = new Resend(process.env.RESEND_API_KEY);

      const ownerResult = await resend.emails.send({
        from: "Cute Clean Soaps <orders@cutecleansoaps.com>",
        to: process.env.ORDER_EMAILS.split(",").map((s) => s.trim()),
        subject: "🧼 New Soap Order",
        text: ownerMessage,
      });

      console.log("Owner email result:", ownerResult);

      if (customerEmail) {
        const customerResult = await resend.emails.send({
          from: "Cute Clean Soaps <orders@cutecleansoaps.com>",
          to: [customerEmail],
          subject: `🧼 Thanks for your order! (${code})`,
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
