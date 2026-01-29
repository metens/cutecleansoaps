import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

initializeApp();
const db = getFirestore();

/**
 * Recompute rating aggregates whenever any review doc changes.
 * Trigger: soaps/{soapId}/reviews/{reviewId}
 */
export const syncSoapRating = onDocumentWritten(
  "soaps/{soapId}/reviews/{reviewId}",
  async (event) => {
    const soapId = event.params.soapId;

    // Read all reviews for this soap
    const reviewsSnap = await db.collection("soaps").doc(soapId).collection("reviews").get();

    let count = 0;
    let sum = 0;

    reviewsSnap.forEach((doc) => {
      const d = doc.data() || {};
      const stars = Number(d.stars || 0);
      if (Number.isFinite(stars) && stars >= 1 && stars <= 5) {
        count += 1;
        sum += stars;
      }
    });

    const avg = count ? sum / count : 0;

    // Write aggregates back to parent soap doc
    await db.collection("soaps").doc(soapId).set(
      {
        ratingCount: count,
        ratingAvg: avg,
      },
      { merge: true }
    );
  }
);
