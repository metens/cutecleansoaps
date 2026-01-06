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
