const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { items } = JSON.parse(event.body || "{}");

    // IMPORTANT: price lookup MUST be server-side (don’t trust browser prices)
    const PRICE_LOOKUP = {
      "Cinnamon Soap": 699,
      "Coconut Soap": 599,
      // add the rest...
    };

    const line_items = (items || []).map((i) => ({
      quantity: i.quantity,
      price_data: {
        currency: "usd",
        unit_amount: PRICE_LOOKUP[i.name],
        product_data: { name: i.name },
      },
    }));

    const origin = event.headers.origin || event.headers.Origin;

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
    return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
  }
};