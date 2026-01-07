import admin from "firebase-admin";

function requireAdmin(req, res) {
  const token = req.query.token || "";
  if (!process.env.ADMIN_TOKEN) {
    res.status(500).json({ error: "Missing ADMIN_TOKEN env var" });
    return false;
  }
  if (token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  });
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    initFirebaseAdmin();
    const db = admin.firestore();

    const limit = Math.min(Number(req.query.limit || 50), 200);

    const snap = await db
      .collection("orders")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const orders = snap.docs.map((d) => {
      const data = d.data();
      // Convert Firestore Timestamp -> ms for easy display in browser
      const createdAtMs =
        data.createdAt?.toMillis ? data.createdAt.toMillis() : null;

      return {
        id: d.id,
        ...data,
        createdAt: createdAtMs,
        shippedAt: data.shippedAt?.toMillis ? data.shippedAt.toMillis() : null,
        deliveredAt: data.deliveredAt?.toMillis ? data.deliveredAt.toMillis() : null,
      };
    });

    res.status(200).json({ orders });
  } catch (err) {
    console.error("admin-list-orders error:", err);
    res.status(500).json({ error: err.message || "Server error" });
  }
}
