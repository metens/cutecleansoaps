const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

exports.onReviewCreated = onDocumentCreated(
  "soaps/{soapId}/reviews/{reviewId}",
  async (event) => {
    const soapId = event.params.soapId;
    const review = event.data?.data();
    if (!review) return;

    const stars = Number(review.stars);
    if (!(stars >= 1 && stars <= 5)) return;

    const soapRef = db.doc(`soaps/${soapId}`);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(soapRef);
      const soap = snap.exists ? snap.data() : {};

      const oldCount = Number(soap.ratingCount || 0);
      const oldAvg = Number(soap.ratingAvg || 0);

      const newCount = oldCount + 1;
      const newAvg = (oldAvg * oldCount + stars) / newCount;

      tx.set(
        soapRef,
        { ratingCount: newCount, ratingAvg: newAvg },
        { merge: true }
      );
    });
  }
);

exports.onOrderCreated = onDocumentCreated("orders/{orderId}", async (event) => {
  const order = event.data?.data();
  if (!order?.items?.length) return;
    if (order.status !== "paid") return; // ✅ ADD THIS

  await db.runTransaction(async (tx) => {
    // read all soaps first
    const soapRefs = order.items.map((it) => db.doc(`soaps/${it.soapId}`));
    const soapSnaps = await Promise.all(soapRefs.map((ref) => tx.get(ref)));

    // validate stock
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      const snap = soapSnaps[i];
      const stock = Number(snap.data()?.stock ?? 0);

      if (!snap.exists) throw new Error(`Missing soap: ${it.soapId}`);
      if (stock < it.qty) throw new Error(`Not enough stock for ${it.soapId}`);
    }

    // write stock decrements
    for (let i = 0; i < order.items.length; i++) {
      const it = order.items[i];
      const snap = soapSnaps[i];
      const stock = Number(snap.data()?.stock ?? 0);

      tx.update(db.doc(`soaps/${it.soapId}`), { stock: stock - it.qty });
    }

    // mark order processed
    tx.update(event.data.ref, { status: "processed" });
  });
});

