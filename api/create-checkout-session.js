const Stripe = require("stripe");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).send(""); // optional
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const { items } = req.body || {};

    const PRICE_LOOKUP = {
      "Cinnamon Soap": 600,
      "Coconut Soap": 600,
      "Honey Soap": 800,
      "Lavender Soap": 800,
      "Citrus Soap": 600,
      "Rose Pedal Soap": 700,
      "Almond Shea Soap": 600,
      "Oatmeal Soap": 600,
    };

    const SOAP_ID_LOOKUP = {
      "Cinnamon Soap": "cinnamon-soap",
      "Coconut Soap": "coconut-soap",
      "Honey Soap": "honey-soap",
      "Lavender Soap": "lavender-soap",
      "Citrus Soap": "citrus-soap",
      "Rose Pedal Soap": "rose-pedal-soap",
      "Almond Shea Soap": "almond-shea-soap",
      "Oatmeal Soap": "oatmeal-soap",
    };

    const line_items = (items || []).map((i) => {
      const unit_amount = PRICE_LOOKUP[i.name];
      const soapId = SOAP_ID_LOOKUP[i.name];
    
      if (!unit_amount) throw new Error("Unknown item: " + i.name);
      if (!soapId) throw new Error("Missing soapId for: " + i.name);
    
      return {
        quantity: i.quantity,
        price_data: {
          currency: "usd",
          unit_amount,
          product_data: {
            name: i.name,
            metadata: { soapId }, // ✅ ADD THIS
          },
        },
      };
    });
    
    const origin = `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
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
