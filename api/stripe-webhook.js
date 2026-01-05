import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    // ⬇️ read RAW body (this replaces bodyParser:false)
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const email = session.customer_details?.email;
    const shipping = session.shipping_details;
    const amount = (session.amount_total / 100).toFixed(2);

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

    const items = lineItems.data
      .map((item) => `${item.description} × ${item.quantity}`)
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

    console.log(message); // we’ll email this next
  }

  res.json({ received: true });
}
