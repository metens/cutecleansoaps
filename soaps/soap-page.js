import { db, auth, ensureAnonAuth } from "../firebase.js";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* =========================
   Session “identity” (no sign-in)
========================= */
const SESSION_ID_KEY = "ccs_session_id_v1";

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_ID_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `sid_${Math.random().toString(16).slice(2)}_${Date.now()}`);
    sessionStorage.setItem(SESSION_ID_KEY, id);
  }
  return id;
}

function likedKey(soapId) {
  return `ccs_liked_${soapId}`; // stores JSON array of reviewIds liked for this soap
}

function getLikedSet(soapId) {
  try {
    const raw = sessionStorage.getItem(likedKey(soapId));
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function rememberLiked(soapId, reviewId) {
  const set = getLikedSet(soapId);
  set.add(reviewId);
  sessionStorage.setItem(likedKey(soapId), JSON.stringify([...set]));
}

/* =========================
   Helpers
========================= */
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(ts) {
  const d = ts?.toDate?.() || null;
  if (!d) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getSoapIdFromUrl() {
  // supports:
  // /soaps/?id=almond-shea-soap
  // /soaps/almond-shea-soap
  const url = new URL(location.href);
  const q = url.searchParams.get("id");
  if (q) return q.trim();

  const parts = location.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last && last !== "soaps" && last !== "index.html") return last;

  return null;
}

/* =========================
   DOM
========================= */
const elTitle = document.getElementById("soap-title");
const elMeta = document.getElementById("soap-meta");
const elReviews = document.getElementById("reviews-list");

const btnSubmit = document.getElementById("review-submit");
const elMsg = document.getElementById("review-msg");
const elText = document.getElementById("review-text");
const cbUseName = document.getElementById("use-name");
const elName = document.getElementById("review-name");

/* =========================
   Load soap + reviews
========================= */
const soapId = getSoapIdFromUrl();
if (!soapId) {
  elTitle.textContent = "Soap not found";
  elReviews.textContent = "Missing soap id in URL.";
} else {
  boot(soapId);
}

async function boot(soapId) {
  await ensureAnonAuth(); // silent, no UI
  // Toggle name input
  if (cbUseName && elName) {
    cbUseName.addEventListener("change", () => {
      elName.style.display = cbUseName.checked ? "inline-block" : "none";
    });
  }

  // Load soap doc
  const soapRef = doc(db, "soaps", soapId);
  const soapSnap = await getDoc(soapRef);
  const soap = soapSnap.exists() ? soapSnap.data() : null;

  elTitle.textContent = soap?.name || prettifySoapId(soapId);

  const avg = Number(soap?.ratingAvg || 0);
  const cnt = Number(soap?.ratingCount || 0);
  const stock = soap?.stock ?? null;
  const price = soap?.price ?? null;

  elMeta.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      ${price != null ? `<span><strong>Price:</strong> $${Number(price).toFixed(2)}</span>` : ""}
      ${stock != null ? `<span><strong>Stock:</strong> ${Number(stock)}</span>` : ""}
      <span><strong>Rating:</strong> ${cnt ? `${avg.toFixed(2)} (${cnt})` : "New"}</span>
    </div>
  `;

  // Reviews live
  const reviewsRef = collection(db, "soaps", soapId, "reviews");
  const q = query(reviewsRef, orderBy("createdAt", "desc"));

  onSnapshot(q, (snap) => {
    if (snap.empty) {
      elReviews.innerHTML = `<p>No reviews yet. Be the first!</p>`;
      return;
    }
    const liked = getLikedSet(soapId);

    const html = snap.docs.map((d) => {
      const r = d.data() || {};
      const rid = d.id;

      const stars = Number(r.stars || 0);
      const txt = escapeHtml(r.text || "");
      const name = r.name ? escapeHtml(r.name) : "Anonymous";
      const date = fmtDate(r.createdAt);
      const likesCount = Number(r.likesCount || 0);

      const disabled = liked.has(rid) ? "disabled" : "";
      const btnText = liked.has(rid) ? "Liked" : "Like";

      return `
        <div class="review-card" data-review-id="${rid}" style="padding:12px;border:1px solid rgba(0,0,0,.12);border-radius:10px;margin:10px 0;">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div>
              <strong>${name}</strong>
              <span style="opacity:.75;margin-left:8px;">${date}</span>
            </div>
            <div aria-label="${stars} out of 5">
              ${renderStarsText(stars)}
            </div>
          </div>

          <p style="margin:10px 0 10px;white-space:pre-wrap;">${txt}</p>

          <div style="display:flex;align-items:center;gap:10px;">
            <button class="like-btn" type="button" ${disabled}>${btnText}</button>
            <span class="like-count" aria-label="Likes">${likesCount}</span>
          </div>
        </div>
      `;
    }).join("");

    elReviews.innerHTML = html;
  });

  // Like handler (one like per session per review)
  elReviews.addEventListener("click", async (e) => {
    const btn = e.target.closest(".like-btn");
    if (!btn) return;

    const card = e.target.closest(".review-card");
    const reviewId = card?.dataset?.reviewId;
    if (!reviewId) return;

    const liked = getLikedSet(soapId);
    if (liked.has(reviewId)) return; // already liked this session

    btn.disabled = true;

    try {
      await likeReviewOncePerSession({ soapId, reviewId });
      rememberLiked(soapId, reviewId);
      btn.textContent = "Liked";
    } catch (err) {
      console.error("Like failed:", err);
      btn.disabled = false;
      btn.textContent = "Like";
    }
  });

  // Submit review (no sign-in)
  btnSubmit?.addEventListener("click", async () => {
    const stars = getSelectedStars();
    const text = String(elText?.value || "").trim();

    if (stars < 1 || stars > 5) {
      setMsg("Please pick a rating (1–5).");
      return;
    }
    if (text.length < 3) {
      setMsg("Please write a short review.");
      return;
    }

    const useName = !!cbUseName?.checked;
    const name = useName ? String(elName?.value || "").trim().slice(0, 40) : "";

    btnSubmit.disabled = true;
    setMsg("Posting…");

    try {
      await addDoc(collection(db, "soaps", soapId, "reviews"), {
        stars,
        text,
        name: name || null,
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        likesCount: 0,
      });      
      
      if (elText) elText.value = "";
      if (elName) elName.value = "";
      if (cbUseName) cbUseName.checked = false;
      if (elName) elName.style.display = "none";

      setMsg("Thanks! Your review was posted.");
    } catch (err) {
      console.error("Review submit failed:", err);
      setMsg("Sorry — couldn’t post your review. Try again.");
    } finally {
      btnSubmit.disabled = false;
    }
  });
}

function prettifySoapId(id) {
  return String(id || "")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function renderStarsText(n) {
  const x = Math.max(0, Math.min(5, Number(n || 0)));
  return "★★★★★☆☆☆☆☆".slice(5 - x, 10 - x);
}

function getSelectedStars() {
  const checked = document.querySelector('input[name="stars"]:checked');
  return Number(checked?.value || 0);
}

function setMsg(s) {
  if (!elMsg) return;
  elMsg.textContent = s;
}

/* =========================
   Like logic:
   - one like per session per review
   - stored in Firestore as: reviews/{reviewId}/likes/{sessionId}
   - increments review.likesCount in a transaction
========================= */
async function likeReviewOncePerSession({ soapId, reviewId }) {
  const sessionId = getSessionId();

  const reviewRef = doc(db, "soaps", soapId, "reviews", reviewId);
  const likeRef = doc(db, "soaps", soapId, "reviews", reviewId, "likes", sessionId);

  await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists()) return; // already liked from this sessionId

    const reviewSnap = await tx.get(reviewRef);
    if (!reviewSnap.exists()) throw new Error("Missing review doc");

    const cur = Number(reviewSnap.data()?.likesCount || 0);

    tx.set(likeRef, { createdAt: serverTimestamp() });
    tx.update(reviewRef, { likesCount: cur + 1 });
  });
}
