import { db, auth, ensureAnonAuth } from "./firebase.js";
import {
  doc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* =========================
   Helpers
========================= */

checkoutBtn.addEventListener("click", async () => {
  ensureAnonAuth();

  // build order items from your cart structure
  const items = cart.map((it) => ({
    soapId: it.soapId,      // MUST be the Firestore doc id like "lavender-soap"
    name: it.name,
    qty: it.qty,
    price: it.price
  }));

  await addDoc(collection(db, "orders"), {
    uid: auth.currentUser?.uid || null,
    items,
    createdAt: serverTimestamp(),
    status: "created"
  });

  // then clear cart locally + close modal
  cart = [];
  updateCartUI();
  closeCartModal();
});


const cart = {};
const CART_STORAGE_KEY = "ccs_cart_v1";
const RESUME_FLAG_KEY = "ccs_resume_checkout";

function saveCartToStorage() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

function updateOneCardUI(soapName) {
  const item = document.querySelector(`.gallery-item[data-name="${soapName}"]`);
  if (!item) return;

  const soap = soaps[soapName];
  if (!soap) return;

  const meta = item.querySelector(".meta-line");
  if (!meta) return;

  const stockText = soap.stock > 0 ? `${soap.stock} left` : "Out of stock";
  const lowStockClass = soap.stock > 0 && soap.stock <= 3 ? "low" : "";
  const soapId = soapIdFromName(name);

  meta.innerHTML = `
    <a class="rating-link" href="/soaps/${soapId}" aria-label="See reviews for ${name}">
      <span class="star-wrap">${renderStarsHTML(soap.ratingAvg || 0)}</span>
      <span class="rating-text">
        ${soap.ratingCount ? (soap.ratingAvg || 0).toFixed(2) : "New"}
        ${soap.ratingCount ? ` (${soap.ratingCount})` : ""}
      </span>
    </a>
    • <span class="${lowStockClass}">${stockText}</span>
  `;

}

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    for (const k in cart) delete cart[k];
    for (const name in saved) cart[name] = saved[name];
    return true;
  } catch {
    return false;
  }
}

function soapIdFromName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function renderStars(ratingAvg) {
  const rounded = Math.round((ratingAvg || 0) * 2) / 2;
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += rounded >= i ? "★" : "☆";
  }
  return stars; // rating 0 => ☆☆☆☆☆
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

async function submitReview(soapName, stars, text) {
  const soapId = soapIdFromName(soapName);
  await addDoc(collection(db, "soaps", soapId, "reviews"), {
    stars: Number(stars),
    text: (text || "").trim(),
    uid: auth.currentUser?.uid || null,
    createdAt: serverTimestamp(),
  });
}

function watchSoapDoc(soapName, onUpdate) {
  const soapId = soapIdFromName(soapName);
  return onSnapshot(doc(db, "soaps", soapId), (snap) => {
    const d = snap.data();
    if (!d) return; // doc must exist in Firestore
    onUpdate({
      avg: Number(d.ratingAvg || 0),
      count: Number(d.ratingCount || 0),
      stock: Number(d.stock ?? 0),
    });
  });
}

/* =========================
   Soap data (local defaults)
   Firestore will override rating/stock live
========================= */

class Soap {
  constructor(ingredients, price, stock = 0, ratingAvg = 0, ratingCount = 0) {
    this.ingredients = ingredients;
    this.price = price;
    this.stock = stock;
    this.ratingAvg = ratingAvg;
    this.ratingCount = ratingCount;
  }
  get inStock() {
    return this.stock > 0;
  }
}

const soaps = {
  "Cinnamon Soap": new Soap(
    [ // Ingredients
      "Cinnamon",
      "Cinnamon Fragrence Oil",
      "Vanilla Fragrance Oil",
      "Shea Soap Base",
      "Vitamin-E Oil",
      "Nutmeg",
      "Cinnamon Topping",
      "Vanilla Extract"
    ],
    6.0,  // Price
    5,    // Quantity in Stock 
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Coconut Soap": new Soap(
    [ // Ingredients
      "Coconut Oil",
      "Shea Soap Base",
      "Coconut",
      "Vitamin-E Oil",
      "Organic Coconut Shreddings"
    ],
    6.0,  // Price
    0,    // Quantity in Stock
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Almond Shea Soap": new Soap(
    [ // Ingredients
      "Goat Soap Base",
      "Almonds",
      "Vitamin-E Oil",
      "Coconut Oil"
    ],
    8.0,  // Price
    12,   // Total Soaps in Stock
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Honey Soap": new Soap(
    [ // Ingredients
      "Pure Organic Honey",
      "Goat Milk Soap Base",
      "Vitamin-E Oil",
      "Natural Coloring"
    ],
    8.0,  // Price
    0,    // Total Stock
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Lavender Soap": new Soap(
    [ // Ingredients
      "Dried Lavender Cloves",
      "Vitamin-E Oil",
      "Clear Soap Base",
      "Lavener Essential Oil",
      "Natural Coloring"
    ],
    8.0,  // Price
    7,    // Total in Stock
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Oatmeal Soap": new Soap(
    [ // Ingredients
      "Goat Milk Soap Base",
      "Shredded Oats + Oat Topping",
      "Brown Sugar",
      "Vitamin-E Oil",
      "Oat Milk",
      "Honey Oil"
    ],
    6.0,  // Price
    10,   // Total in Stock
    0,    // Average Rating
    0     // Total Ratings
  ),
  "Citrus Soap": new Soap(
    ["Olive oil", "Orange Juice", "Lemon Skin", "Lye"],
    6.0,
    0,
    0,
    0),
  "Rose Pedal Soap": new Soap(
    ["Rose Pedals", "Olive oil", "Rose Essential Oil", "Lye"],
    7.0,
    0,
    0,
    0
  ),
};

/* =========================
   Main
========================= */

document.addEventListener("DOMContentLoaded", () => {

  /*document.addEventListener("click", (e) => {
    const link = e.target.closest(".rating-link");
    if (link) e.stopPropagation();
  });*/

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".rating-link");
    if (link) e.stopPropagation();
  });



  ensureAnonAuth();
  console.log("script running, items:", document.querySelectorAll(".gallery-item").length);
  // ----- Grab elements -----
  const items = document.querySelectorAll(".gallery-item");

  const modal = document.getElementById("soap-modal");
  const nameEl = document.getElementById("modal-name");
  const ingredientsEl = document.getElementById("modal-ingredients");
  const priceEl = document.getElementById("modal-price");
  const totalEl = document.getElementById("modal-total");
  const countEl = document.getElementById("count");
  const ratingEl = document.getElementById("modal-rating");
  const stockEl = document.getElementById("modal-stock");

  const plusBtn = document.getElementById("plus");
  const minusBtn = document.getElementById("minus");
  const closeBtn = document.querySelector(".close-btn");

  const cartCountEl = document.getElementById("cart-count");
  const cartTotalEl = document.getElementById("cart-total");
  const cartModal = document.getElementById("cart-modal");
  const cartItemsEl = document.getElementById("cart-items");
  const closeCartBtn = document.getElementById("close-cart");
  const cartBtn = document.getElementById("cart-btn");
  const addToCartBtn = document.getElementById("add-to-cart");
  const checkoutBtn = document.getElementById("checkout-btn");

  // Reviews UI (must exist in modal HTML)
  const reviewStarsEl = document.getElementById("review-stars");
  //const reviewTextEl = document.getElementById("review-text");
  //const reviewSubmitBtn = document.getElementById("review-submit");

  let currentSoap = null;
  let currentSoapName = null;
  let count = 1;
  let unwatchSoap = null;

  function updateCartButton() {
    let totalItems = 0;
    let totalPrice = 0;
    for (const n in cart) {
      totalItems += cart[n].quantity;
      totalPrice += cart[n].quantity * cart[n].price;
    }
    cartCountEl.textContent = totalItems;
    cartTotalEl.textContent = totalPrice.toFixed(2);
    saveCartToStorage();
  }

  function renderCart() {
    cartItemsEl.innerHTML = "";
    let totalItems = 0;
    let totalPrice = 0;

    for (const n in cart) {
      const item = cart[n];
      const lineTotal = item.quantity * item.price;

      totalItems += item.quantity;
      totalPrice += lineTotal;

      const row = document.createElement("div");
      row.className = "cart-row";
      row.innerHTML = `
        <span class="cart-name">${n}</span>
        <div class="cart-qty-controls">
          <button class="qty-btn" data-action="dec" data-name="${n}">−</button>
          <span class="cart-qty">${item.quantity}</span>
          <button class="qty-btn" data-action="inc" data-name="${n}">+</button>
        </div>
        <span class="cart-line-total">$${lineTotal.toFixed(2)}</span>
      `;
      cartItemsEl.appendChild(row);
    }

    document.getElementById("cart-items-total").textContent = totalItems;
    document.getElementById("cart-price-total").textContent = totalPrice.toFixed(2);
    updateCartButton();
  }

  function updateOneCardUI(name) {
    const soap = soaps[name];
    const card = document.querySelector(`.gallery-item[data-name="${name}"]`);
    if (!card) return;

    const meta = card.querySelector(".meta-line");
    if (meta) {
      const stockText = soap.stock > 0 ? `${soap.stock} left` : "Out of stock";
      const lowStockClass = soap.stock > 0 && soap.stock <= 3 ? "low" : "";
      const soapId = soapIdFromName(name);

      meta.innerHTML = `
        <a class="rating-link" href="/soaps/${soapId}" aria-label="See reviews for ${name}">
          <span class="star-wrap">${renderStarsHTML(soap.ratingAvg || 0)}</span>
          <span class="rating-text">
            ${soap.ratingCount ? (soap.ratingAvg || 0).toFixed(2) : "New"}
            ${soap.ratingCount ? ` (${soap.ratingCount})` : ""}
          </span>
        </a>
        • <span class="${lowStockClass}">${stockText}</span>
      `;

    }

    // block click styling if out
    if (!soap.inStock) card.classList.add("out");
    else card.classList.remove("out");
  }

  function fillAllCards() {
    items.forEach((item) => {
      const name = item.dataset.name;
      const soap = soaps[name];
      if (!soap) return;

      const overlay = item.querySelector(".overlay");
      if (overlay) {
        overlay.innerHTML = `
          <strong>${name}</strong>
          <small>${soap.ingredients.join(", ")}</small>
          <span>Price: $${soap.price.toFixed(2)}</span>
        `;
      }

      updateOneCardUI(name);
    });
  }

  function openModalFor(name) {
    const soap = soaps[name];
    if (!soap || !soap.inStock) return;

    currentSoap = soap;
    currentSoapName = name;
    count = 1;

    nameEl.textContent = name;
    ingredientsEl.textContent = "Ingredients: " + soap.ingredients.join(", ");
    priceEl.textContent = soap.price.toFixed(2);
    countEl.textContent = count;
    totalEl.textContent = (count * soap.price).toFixed(2);

    // stop previous listener
    if (unwatchSoap) unwatchSoap();

    // live sync from Firestore soap doc
    unwatchSoap = watchSoapDoc(name, ({ avg, count: cnt, stock }) => {
      soap.ratingAvg = avg;
      soap.ratingCount = cnt;
      soap.stock = stock;

      ratingEl.innerHTML = "none";
      /*ratingEl.innerHTML = `
        <span class="star" style="font-size:20px;">${renderStarsHTML(avg)}</span>
        <span style="font-size:14px;"> ${avg.toFixed(1)}${cnt ? ` (${cnt})` : ""}</span>
      `;*/

      if (stock <= 0) {
        stockEl.textContent = "Out of stock";
        stockEl.style.color = "#c0392b";
      } else if (stock <= 3) {
        stockEl.textContent = `Only ${stock} left!`;
        stockEl.style.color = "#c0392b";
      } else {
        stockEl.textContent = `${stock} in stock`;
        stockEl.style.color = "#333";
      }

      updateOneCardUI(name);

      // prevent selecting more than stock
      if (count > stock) {
        count = Math.max(1, stock);
        countEl.textContent = count;
        totalEl.textContent = (count * soap.price).toFixed(2);
      }
    });

    modal.classList.remove("hidden");
  }

  // ----- Gallery clicks open modal -----
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const name = item.dataset.name;
      openModalFor(name);
    });
  });

  // ----- Modal controls -----
  plusBtn.onclick = () => {
    if (!currentSoap) return;
    if (count < currentSoap.stock) {
      count++;
      countEl.textContent = count;
      totalEl.textContent = (count * currentSoap.price).toFixed(2);
    }
  };

  minusBtn.onclick = () => {
    if (!currentSoap) return;
    if (count > 1) {
      count--;
      countEl.textContent = count;
      totalEl.textContent = (count * currentSoap.price).toFixed(2);
    }
  };

  closeBtn.onclick = () => {
    modal.classList.add("hidden");
  };

  // ----- Add to cart -----
  addToCartBtn.addEventListener("click", () => {
    if (!currentSoap || !currentSoap.inStock) return;

    const name = currentSoapName;
    const available = currentSoap.stock;
    const addQty = Math.min(count, available);
    if (addQty <= 0) return;

    if (!cart[name]) cart[name] = { price: currentSoap.price, quantity: 0 };
    cart[name].quantity += addQty;

    // local stock decrease (Firestore stock is separate — you’ll handle real stock later if you want)
    currentSoap.stock -= addQty;

    updateCartButton();
    updateOneCardUI(name);
    modal.classList.add("hidden");
  });

  // ----- Cart modal open/close -----
  cartBtn.addEventListener("click", () => {
    renderCart();
    cartModal.classList.remove("hidden");
  });

  closeCartBtn?.addEventListener("click", () => {
    cartModal.classList.add("hidden");
  });

  cartModal.addEventListener("click", (e) => {
    if (e.target === cartModal) cartModal.classList.add("hidden");
  });

  // cart qty buttons in cart modal
  cartItemsEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button.qty-btn");
    if (!btn) return;

    const name = btn.dataset.name;
    const action = btn.dataset.action;
    if (!cart[name]) return;

    if (action === "inc") cart[name].quantity += 1;
    if (action === "dec") {
      cart[name].quantity -= 1;
      if (cart[name].quantity <= 0) delete cart[name];
    }

    renderCart();
  });

  // ----- Restore cart on refresh -----
  if (loadCartFromStorage()) updateCartButton();

  // ----- Resume flow (your existing flag) -----
  const shouldResume = localStorage.getItem(RESUME_FLAG_KEY) === "1";
  if (shouldResume) {
    // you can optionally open cart modal here
    localStorage.removeItem(RESUME_FLAG_KEY);
  }

  // ----- Reviews submit -----
  /*reviewSubmitBtn?.addEventListener("click", async () => {
    if (!currentSoap) return;
    const soapName = currentSoapName;

    await submitReview(soapName, reviewStarsEl.value, reviewTextEl.value);
    reviewTextEl.value = "";
    // After you deploy the Cloud Function, avg/count will update automatically and
    // the live onSnapshot will refresh UI.
  });*/

  // ----- Checkout -----
  checkoutBtn?.addEventListener("click", async () => {
    const items = Object.entries(cart).map(([name, v]) => ({
      name,
      quantity: v.quantity,
    }));

    if (items.length === 0) {
      alert("Your cart is empty!");
      return;
    }

    saveCartToStorage();
    localStorage.setItem(RESUME_FLAG_KEY, "1");

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.log("Function failed:", res.status, text);
      alert(`Checkout failed (${res.status}). Open Console for details.`);
      return;
    }

    const data = JSON.parse(text);
    window.location.href = data.url;
  });

  // ----- Initial render -----
  fillAllCards();

  for (const name of Object.keys(soaps)) {
    watchSoapDoc(name, ({ avg, count, stock }) => {
      soaps[name].ratingAvg = avg;
      soaps[name].ratingCount = count;
      soaps[name].stock = stock;
      updateOneCardUI(name); // ✅ live refresh on the gallery
    });
  }
});
