const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { items } = JSON.parse(event.body || "{}");

    const PRICE_LOOKUP = {
      "Cinnamon Soap": 699,
      "Coconut Soap": 599,
      // add the rest...
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

    const origin = `${event.headers["x-forwarded-proto"] || "http"}://${event.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/success.html`,
      cancel_url: `${origin}/cancel.html`,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};