const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send(""); // optional
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { items } = req.body || {};

    const PRICE_LOOKUP = {
      "Cinnamon Soap": 400,
      "Coconut Soap": 400,
      "Honey Soap": 500,
      "Lavender Soap": 500,
      "Olive Soap": 600,
      "Citrus Soap": 400,
      "Rose Soap": 400,
      "Oatmeal Soap": 500,
      "Aloe Vera Soap": 400,
      "Shea Soap": 400,
      "Vanilla Chai Soap": 500,
    };

    const line_items = (items || []).map((i) => {
      const unit_amount = PRICE_LOOKUP[i.name];
      if (!unit_amount) throw new Error("Unknown item: " + i.name);

      return {
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount,
          product_data: { name: i.name },
        },
      };
    });

    const origin = `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/cancel.html`,
      shipping_address_collection: { allowed_countries: ["US"] }, // if you want shipping
      phone_number_collection: { enabled: true },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
