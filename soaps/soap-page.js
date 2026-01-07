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

function renderStarsHTML(ratingAvg) {
  const v = Math.max(0, Math.min(5, Number(ratingAvg || 0)));
  const step = 0.25; // quarter stars
  const snapped = Math.round(v / step) * step;

  let html = `<span class="star-rating" aria-label="${snapped} out of 5">`;
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, snapped - (i - 1))); // 0..1
    html += `<span class="star" style="--fill:${fill}"></span>`;
  }
  html += `</span>`;
  return html;
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

    ratingEl.innerHTML = `
  <span class="star-wrap">${renderStarsHTML(avg)}</span>
  <span class="rating-text">${avg.toFixed(2)}${count ? ` (${count})` : ""}</span>
`;

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

        const text = (r.text || "")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");

        const name = r.displayName || "Anonymous";
        const when = r.createdAt?.toDate
          ? r.createdAt.toDate().toLocaleDateString()
          : "";

        return `
      <div style="padding:10px 0;border-bottom:1px solid #eee;">
        <div>
          <strong>${name}</strong>
          <span style="opacity:.6;font-size:12px;"> · ${when}</span>
        </div>
        <div>${"★".repeat(Number(r.stars) || 0)}${"☆".repeat(5 - (Number(r.stars) || 0))}</div>
        <div style="opacity:.9">${text}</div>
      </div>
    `;
      })
      .join("");
  });

  const useNameEl = document.getElementById("use-name");
  const nameInputEl = document.getElementById("review-name");

  useNameEl.addEventListener("change", () => {
    nameInputEl.style.display = useNameEl.checked ? "block" : "none";
  });


  // 3) Submit review
  document.getElementById("review-submit").addEventListener("click", async () => {
    await ensureAnonAuth();

    const stars = Number(document.getElementById("review-stars").value);
    const text = document.getElementById("review-text").value.trim();

    const useName = document.getElementById("use-name").checked;
    const nameInput = document.getElementById("review-name").value.trim();

    const uid = auth.currentUser?.uid || "";
    const displayName = useName && nameInput
      ? nameInput
      : "Anonymous";

    if (!stars || !text) return;

    await addDoc(collection(db, "soaps", slug, "reviews"), {
      stars,
      text,
      displayName,                 // ✅ chosen or anonymous
      uid,
      createdAt: serverTimestamp() // ✅ timestamp
    });

    document.getElementById("review-text").value = "";
    document.getElementById("review-name").value = "";
    document.getElementById("use-name").checked = false;
    nameInputEl.style.display = "none";
  });

});