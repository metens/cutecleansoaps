import Stripe from "stripe";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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

      const message = `
NEW ORDER 🧼

Email: ${email}

Items:
${itemsText}

Total: $${amount}

Ship To:
${shipping?.name || "(no shipping name)"}
${address.line1 || ""}
${address.line2 || ""}
${address.city || ""}, ${address.state || ""} ${address.postal_code || ""}
${address.country || ""}

Phone: ${shipping?.phone || "N/A"}
      `.trim();

      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "Cute Clean Soaps <onboarding@resend.dev>",
        to: process.env.ORDER_EMAILS.split(",").map((s) => s.trim()),
        subject: "🧼 New Soap Order",
        text: message,
      });
      console.log("Resend: email sent to", process.env.ORDER_EMAILS);
    }
  } catch (err) {
    console.error("Webhook processing failed:", err);
  }

  return res.status(200).json({ received: true });
}
