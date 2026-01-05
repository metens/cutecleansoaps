import Stripe from "stripe";
import crypto from "crypto";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Deterministic confirmation code derived from session_id (no DB needed)
function confirmationCode(sessionId) {
    const salt = process.env.ORDER_CODE_SALT || "ccs_default_salt_change_me";
    const hex = crypto.createHash("sha256").update(sessionId + salt).digest("hex");
    return "CCS-" + hex.slice(0, 8).toUpperCase();
}

export default async function handler(req, res) {
    try {
        const session_id = req.query.session_id;
        if (!session_id) return res.status(400).json({ error: "Missing session_id" });

        const session = await stripe.checkout.sessions.retrieve(session_id);
        const lineItems = await stripe.checkout.sessions.listLineItems(session_id);

        const items = lineItems.data.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            amount_total: i.amount_total ?? null, // sometimes null depending on Stripe config
        }));

        return res.status(200).json({
            session_id,
            code: confirmationCode(session_id),
            currency: session.currency,
            amount_total: session.amount_total,
            customer_email: session.customer_details?.email || null,
            customer_name: session.customer_details?.name || null,
            shipping_name:
                session.shipping_details?.name || session.customer_details?.name || null,
            shipping_address:
                session.shipping_details?.address || session.customer_details?.address || null,
            phone:
                session.shipping_details?.phone || session.customer_details?.phone || null,
            items,
        });
    } catch (err) {
        console.error("order-summary error:", err);
        return res.status(500).json({ error: err.message });
    }
}
