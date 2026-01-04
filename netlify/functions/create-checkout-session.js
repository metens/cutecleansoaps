const Stripe = require("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const headers = {
    "Access-Control-Allow-Origin": "*", // or "https://YOURNAME.github.io" for stricter
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
};

exports.handler = async (event) => {
    // Handle preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "" };
    }

    if (event.httpMethod !== "POST") {
        return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
    }

    try {
        const { items } = JSON.parse(event.body || "{}");

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

        const origin = `${event.headers["x-forwarded-proto"] || "https"}://${event.headers.host}`;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items,
            success_url: `${YOUR_ORIGIN}/success.html`,
            cancel_url: `${YOUR_ORIGIN}/cancel.html`,
          });

        return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};