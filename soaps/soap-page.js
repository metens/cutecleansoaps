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
  runTransaction,
  increment,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

// ---------- Helpers ----------
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

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRealSignedIn(user) {
  return !!user && user.isAnonymous === false;
}

function uspsTrackingUrl(trk) {
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trk)}`;
}

function likedKey(slug, uid) {
  return `ccs_liked_${slug}_${uid}`;
}

function getLikedSet(slug, uid) {
  try {
    const raw = localStorage.getItem(likedKey(slug, uid));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveLikedSet(slug, uid, set) {
  try {
    localStorage.setItem(likedKey(slug, uid), JSON.stringify([...set]));
  } catch {}
}

// ---------- Main ----------
document.addEventListener("DOMContentLoaded", async () => {
  // Keep anon auth so the page always has an auth context,
  // but we will BLOCK reviews/likes unless user is NOT anonymous.
  await ensureAnonAuth();

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

  const reviewStarsEl = document.getElementById("review-stars");
  const reviewTextEl = document.getElementById("review-text");
  const useNameEl = document.getElementById("use-name");
  const nameInputEl = document.getElementById("review-name");
  const submitBtn = document.getElementById("review-submit");

  // ----- Insert an auth bar above the review form (no HTML changes needed)
  const authBar = document.createElement("div");
  authBar.style.margin = "12px 0";
  authBar.style.display = "flex";
  authBar.style.gap = "10px";
  authBar.style.flexWrap = "wrap";
  authBar.style.alignItems = "center";

  // Put it right above the submit button if possible
  if (submitBtn?.parentElement) {
    submitBtn.parentElement.insertBefore(authBar, submitBtn);
  }

  const signInBtn = document.createElement("button");
  signInBtn.textContent = "Sign in to review";
  signInBtn.style.padding = "10px 12px";
  signInBtn.style.borderRadius = "10px";
  signInBtn.style.border = "1px solid #ddd";
  signInBtn.style.background = "#fff";
  signInBtn.style.cursor = "pointer";

  const signOutBtn = document.createElement("button");
  signOutBtn.textContent = "Sign out";
  signOutBtn.style.padding = "10px 12px";
  signOutBtn.style.borderRadius = "10px";
  signOutBtn.style.border = "1px solid #ddd";
  signOutBtn.style.background = "#fff";
  signOutBtn.style.cursor = "pointer";

  const whoEl = document.createElement("span");
  whoEl.style.opacity = "0.8";
  whoEl.style.fontSize = "13px";

  authBar.appendChild(signInBtn);
  authBar.appendChild(signOutBtn);
  authBar.appendChild(whoEl);

  async function doGoogleSignIn() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  signInBtn.addEventListener("click", async () => {
    try {
      await doGoogleSignIn();
    } catch (e) {
      console.error("signIn failed:", e);
      alert("Sign in failed. Try again.");
    }
  });

  signOutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      // Optional: fall back to anon so the site still works
      await ensureAnonAuth();
    } catch (e) {
      console.error("signOut failed:", e);
    }
  });

  function setReviewFormEnabled(enabled) {
    if (reviewStarsEl) reviewStarsEl.disabled = !enabled;
    if (reviewTextEl) reviewTextEl.disabled = !enabled;
    if (useNameEl) useNameEl.disabled = !enabled;
    if (nameInputEl) nameInputEl.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;

    if (!enabled && reviewTextEl) {
      reviewTextEl.placeholder = "Sign in to write a review.";
    }
    if (enabled && reviewTextEl) {
      reviewTextEl.placeholder = "Write your review...";
    }
  }

  onAuthStateChanged(auth, (user) => {
    const ok = isRealSignedIn(user);
    signInBtn.style.display = ok ? "none" : "inline-block";
    signOutBtn.style.display = ok ? "inline-block" : "none";
    whoEl.textContent = ok ? `Signed in as ${user.email || user.displayName || "user"}` : "Not signed in";
    setReviewFormEnabled(ok);
    // Re-render likes disabled state (so buttons disable properly after sign in/out)
    lastReviewDocs && renderReviews(lastReviewDocs);
  });

  // ----- Name toggle
  useNameEl?.addEventListener("change", () => {
    if (!nameInputEl) return;
    nameInputEl.style.display = useNameEl.checked ? "block" : "none";
  });

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

  // 2) Live recent reviews
  const reviewsQ = query(
    collection(db, "soaps", slug, "reviews"),
    orderBy("createdAt", "desc"),
    limit(20)
  );

  let lastReviewDocs = null;

  function renderReviews(docs) {
    lastReviewDocs = docs;

    if (!docs || docs.length === 0) {
      reviewsListEl.textContent = "No reviews yet.";
      return;
    }

    const user = auth.currentUser;
    const ok = isRealSignedIn(user);
    const uid = ok ? user.uid : null;
    const likedSet = ok ? getLikedSet(slug, uid) : new Set();

    reviewsListEl.innerHTML = docs
      .map((docSnap) => {
        const r = docSnap.data();
        const reviewId = docSnap.id;

        const name = escapeHtml(r.displayName || "Anonymous");
        const when = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : "";
        const stars = Math.max(0, Math.min(5, Number(r.stars) || 0));
        const text = escapeHtml(r.text || "");
        const likesCount = Number(r.likesCount || 0);

        const alreadyLiked = ok && likedSet.has(reviewId);
        const likeDisabled = !ok || alreadyLiked;

        return `
          <div class="review-card" style="background:#eff6ff;border:1px solid #dbeafe;border-radius:14px;padding:12px 14px;margin:10px 0;">
            <div class="review-meta" style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">
              <div><strong>${name}</strong></div>
              <div style="opacity:.7;font-size:12px;">${escapeHtml(when)}</div>
            </div>

            <div class="review-stars" style="margin-top:6px;">
              ${"★".repeat(stars)}${"☆".repeat(5 - stars)}
            </div>

            <div class="review-text" style="margin-top:8px;line-height:1.45;opacity:.92;">
              ${text}
            </div>

            <button
              class="like-btn"
              data-like="${reviewId}"
              ${likeDisabled ? "disabled" : ""}
              style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;border:1px solid #dbeafe;background:rgba(255,255,255,.7);border-radius:999px;padding:6px 10px;cursor:${likeDisabled ? "not-allowed" : "pointer"};opacity:${likeDisabled ? ".6" : "1"};"
              title="${!ok ? "Sign in to like" : alreadyLiked ? "You already liked this" : "Like this review"}"
            >
              👍 <span data-like-count="${reviewId}">${likesCount}</span>
            </button>
          </div>
        `;
      })
      .join("");
  }

  onSnapshot(reviewsQ, (snap) => {
    renderReviews(snap.docs);
  });

  // 3) Like logic (once per user)
  async function likeReview(reviewId) {
    const user = auth.currentUser;
    if (!isRealSignedIn(user)) {
      alert("Please sign in to like reviews.");
      return;
    }

    const uid = user.uid;
    const likedSet = getLikedSet(slug, uid);
    if (likedSet.has(reviewId)) return;

    const reviewRef = doc(db, "soaps", slug, "reviews", reviewId);
    const likeRef = doc(db, "soaps", slug, "reviews", reviewId, "likes", uid);

    await runTransaction(db, async (tx) => {
      const likeSnap = await tx.get(likeRef);
      if (likeSnap.exists()) return; // already liked (server-enforced)

      tx.set(likeRef, { createdAt: serverTimestamp() });
      tx.update(reviewRef, { likesCount: increment(1) });
    });

    // UI disable immediately (even before snapshot refresh)
    likedSet.add(reviewId);
    saveLikedSet(slug, uid, likedSet);

    const btn = reviewsListEl.querySelector(`button[data-like="${CSS.escape(reviewId)}"]`);
    if (btn) btn.disabled = true;
  }

  reviewsListEl?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-like]");
    if (!btn) return;
    await likeReview(btn.dataset.like);
  });

  // 4) Submit review (signed-in users only)
  submitBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!isRealSignedIn(user)) {
      alert("Please sign in to write a review.");
      return;
    }

    const stars = Number(reviewStarsEl?.value);
    const text = reviewTextEl?.value?.trim() || "";

    const useName = !!useNameEl?.checked;
    const nameInput = nameInputEl?.value?.trim() || "";

    const displayName =
      useName && nameInput ? nameInput : (user.displayName || user.email || "Anonymous");

    if (!stars || !text) return;

    await addDoc(collection(db, "soaps", slug, "reviews"), {
      stars,
      text,
      displayName,
      uid: user.uid,
      createdAt: serverTimestamp(),
      likesCount: 0,
    });

    if (reviewTextEl) reviewTextEl.value = "";
    if (nameInputEl) nameInputEl.value = "";
    if (useNameEl) useNameEl.checked = false;
    if (nameInputEl) nameInputEl.style.display = "none";
  });
});
