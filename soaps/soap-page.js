import { db, auth, ensureAnonAuth } from "/firebase.js";
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

function renderStars(avg) {
  const rounded = Math.round((Number(avg || 0)) * 2) / 2;
  let s = "";
  for (let i = 1; i <= 5; i++) s += rounded >= i ? "★" : "☆";
  return s;
}

function getSlug() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts[0] === "soaps" ? parts[1] : null; // /soaps/:slug
}

document.addEventListener("DOMContentLoaded", async () => {
  ensureAnonAuth();

  const slug = getSlug();
  if (!slug) {
    document.getElementById("soap-title").textContent = "No soap selected";
    return;
  }

  const titleEl = document.getElementById("soap-title");
  const ratingEl = document.getElementById("soap-rating");
  const stockEl = document.getElementById("soap-stock");
  const ingredientsEl = document.getElementById("soap-ingredients");
  const reviewsListEl = document.getElementById("reviews-list");

  // 1) Live soap doc
  onSnapshot(doc(db, "soaps", slug), (snap) => {
    const d = snap.data();
    if (!d) {
      titleEl.textContent = "Soap not found in Firestore";
      ratingEl.textContent = "";
      stockEl.textContent = "";
      ingredientsEl.textContent = "";
      return;
    }

    document.title = d.name || slug;

    titleEl.textContent = d.name || slug;
    const avg = Number(d.ratingAvg || 0);
    const count = Number(d.ratingCount || 0);

    ratingEl.innerHTML = `<span class="star">${renderStars(avg)}</span> ${avg.toFixed(1)}${count ? ` (${count})` : ""}`;

    const stock = Number(d.stock ?? 0);
    stockEl.textContent =
      stock <= 0 ? "Out of stock" : stock <= 3 ? `Only ${stock} left!` : `${stock} in stock`;

    ingredientsEl.textContent = d.ingredients ? `Ingredients: ${d.ingredients.join(", ")}` : "";
  });

  // 2) Live recent reviews (optional, but nice)
  const reviewsQ = query(
    collection(db, "soaps", slug, "reviews"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  onSnapshot(reviewsQ, (snap) => {
    if (snap.empty) {
      reviewsListEl.textContent = "No reviews yet.";
      return;
    }
    reviewsListEl.innerHTML = snap.docs
      .map((docSnap) => {
        const r = docSnap.data();
        const stars = "★★★★★☆☆☆☆☆".slice(5 - (r.stars || 0), 10 - (r.stars || 0)); // quick display
        const text = (r.text || "").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
        return `<div style="padding:10px 0;border-bottom:1px solid #eee;">
          <div>${stars}</div>
          <div style="opacity:.9">${text}</div>
        </div>`;
      })
      .join("");
  });

  // 3) Submit review
  document.getElementById("review-submit").addEventListener("click", async () => {
    const stars = Number(document.getElementById("review-stars").value);
    const text = document.getElementById("review-text").value;

    await addDoc(collection(db, "soaps", slug, "reviews"), {
      stars,
      text: (text || "").trim(),
      uid: auth.currentUser?.uid || null,
      createdAt: serverTimestamp(),
    });

    document.getElementById("review-text").value = "";
  });
});

