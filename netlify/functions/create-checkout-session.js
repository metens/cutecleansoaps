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
            "Cinnamon Soap": 699,
            "Coconut Soap": 599,
            "Honey Soap": 649,
            "Lavander Soap": 499,
            "Olive Soap": 799,
            "Citrus Soap": 499,
            "Rose Soap": 649,
            "Oatmeal Soap": 574,
            "Aloe Vera Soap": 649,
            "Shea Soap": 599,
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
            line_items,
            success_url: `${origin}/success.html`,
            cancel_url: `${origin}/cancel.html`,
        });

        return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };
    } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
};