import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Pull useful info
    const email = session.customer_details?.email;
    const shipping = session.shipping_details;
    const amount = (session.amount_total / 100).toFixed(2);

    // Get line items
    const lineItems = await stripe.checkout.sessions.listLineItems(
      session.id
    );

    const items = lineItems.data
      .map(
        (item) =>
          `${item.description} × ${item.quantity}`
      )
      .join("\n");

    const message = `
NEW ORDER 🧼

Email: ${email}

Items:
${items}

Total: $${amount}

Ship To:
${shipping.name}
${shipping.address.line1}
${shipping.address.line2 || ""}
${shipping.address.city}, ${shipping.address.state} ${shipping.address.postal_code}
${shipping.address.country}

Phone: ${shipping.phone || "N/A"}
    `;

    // 🔴 TEMP: log it (next step emails it)
    console.log(message);
  }

  res.json({ received: true });
}

