import { db, auth, ensureAnonAuth } from "./firebase.js";
import {
  doc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* =========================
   Page flags
========================= */
const IS_HOME = document.body.classList.contains("home");
const IS_SOAP_PAGE = location.pathname.startsWith("/soaps/");
const IS_SHOP = location.pathname.endsWith("/shop.html");

/* =========================
   Cart + Storage (SHOP ONLY)
========================= */
const cart = {};
const CART_STORAGE_KEY = "ccs_cart_v1";
const RESUME_FLAG_KEY = "ccs_resume_checkout";

function saveCartToStorage() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
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

function cartQty(name) {
  return Number(cart?.[name]?.quantity || 0);
}

function availableStock(name) {
  return Math.max(0, Number(soaps?.[name]?.stock ?? 0) - cartQty(name));
}

/* =========================
   Helpers
========================= */
function soapIdFromName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function renderStarsHTML(ratingAvg) {
  const v = Math.max(0, Math.min(5, Number(ratingAvg || 0)));
  const step = 0.25;
  const snapped = Math.round(v / step) * step;

  let html = `<span class="star-rating" aria-label="${snapped} out of 5">`;
  for (let i = 1; i <= 5; i++) {
    const fill = Math.max(0, Math.min(1, snapped - (i - 1))); // 0..1
    html += `<span class="star" style="--fill:${fill}"></span>`;
  }
  html += `</span>`;
  return html;
}

function watchSoapDoc(soapName, onUpdate) {
  const soapId = soapIdFromName(soapName);
  return onSnapshot(doc(db, "soaps", soapId), (snap) => {
    const d = snap.data();
    if (!d) return;
    onUpdate({
      avg: Number(d.ratingAvg || 0),
      count: Number(d.ratingCount || 0),
      stock: Number(d.stock ?? 0),
      price: d.price,
      name: d.name,
    });
  });
}

/* =========================
   Soap data (local defaults)
   Firestore overrides rating/stock live
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
    [ // ingredients
      "Goat Milk",
      "Cinnamon & Vanilla Fragrance Oil",
      "Cinnamon",
      "Vitamin-E Oil",
      "Brown Mica Powder",
    ],
    8.0, // price
    5 // stock
  ),
  "Coconut Soap": new Soap(
    [
      "Goat Milk", 
      "Organic Coconut Shavings", 
      "Vitamin-E Oil", 
      "Coconut Oil", 
      "Coconut Fragrance Oil"
    ],
    8.0,
    0
  ),
  "Almond Shea Soap": new Soap(
    [
      "Goat Milk", 
      "Organic Blended Almonds & Whole Almond Topping", 
      "Vitamin-E Oil", 
      "Almond Fragrance Oil"
    ],
    8.0,
    12
  ),
  "Honey Soap": new Soap(
    [
      "Goat Milk", 
      "Pure Organic Honey", 
      "Nutmeg", 
      "Honey & Milk Fragrance Oil", 
      "Vitamin E Oil"
    ],
    8.0,
    0
  ),
  "Lavender Soap": new Soap(
    [
      "Clear Glycerin & Goat Milk", 
      "Lavender Cloves", 
      "Vitamin-E Oil", 
      "Lavender Essential Oil", 
      "Lavender Mica Powder"
    ],
    8.0,
    7
  ),
  "Oatmeal Soap": new Soap(
    [
      "Goat Milk", 
      "Blended Oats & Whole Oat Topping", 
      "Vitamin-E Oil", 
      "Honey & Milk Fragrance Oil"],
    8.0,
    10
  ),
  "Rose Pedal Soap": new Soap(
    [
      "Clear Glycerin", 
      "Dried Rose Pedals", 
      "Rose Essential Oil", 
      "Pink Mica Powder", 
      "Vitamin-E Oil", 
      "Rose Water"
    ],
    8.0,
    5
  ),
  "Orange Soap": new Soap(
    [
      "Clear Glycerin & Goat Milk", 
      "Organic Orange Shavings", 
      "Orange Fragrance Oil", 
      "Orange Essential Oil", 
      "Orange Mica Powder"
    ],
    8.0,
    6
  ),
  "Honey Marble Soap": new Soap(
    [
      "Goat Milk", 
      "Vitamin‑E Oil", 
      "Organic Raw Honey",
      "Nutmeg"
    ],
    20.0,
    0
  ),
};

/* =========================
   Modal Carousel Photos
========================= */
const SOAP_PHOTOS = {
  "Almond Shea Soap": ["images/almond1.png", "images/almond2.JPG"],
  "Honey Soap": ["images/honey1.png", "images/honey2.png"],
  "Lavender Soap": ["images/lav1.png", "images/lav2.png"],
  "Oatmeal Soap": ["images/oat1.jpg", "images/oat2.png"],
  "Coconut Soap": ["images/coconut1.png", "images/coconut2.png", "images/coconut3.png"],
  "Cinnamon Soap": ["images/cinnamon.JPG", "images/cinnamon2.png"],
  "Rose Pedal Soap": ["images/rose1.png", "images/rose2.png"],
  "Orange Soap": ["images/orange1.png", "images/orange2.png"],
  "Honey Marble Soap": ["images/honey-marble.png", "images/ball_soap.mp4"],
};

function setModalCarousel(soapName) {
  const photos = SOAP_PHOTOS[soapName] || [];
  const track = document.getElementById("modal-track");
  const dotsWrap = document.getElementById("modal-dots");
  const prev = document.querySelector(".mcar-btn.prev");
  const next = document.querySelector(".mcar-btn.next");
  if (!track || !dotsWrap) return;

  track.innerHTML = photos
    .map(
      (src, i) =>
        `<img src="${src}" alt="${soapName} photo ${i + 1}" draggable="false">`
    )
    .join("");

  dotsWrap.innerHTML = photos
    .map((_, i) => `<span class="dot ${i === 0 ? "is-active" : ""}"></span>`)
    .join("");

  const hasMany = photos.length > 1;
  if (prev) prev.style.display = hasMany ? "" : "none";
  if (next) next.style.display = hasMany ? "" : "none";
  dotsWrap.style.display = hasMany ? "" : "none";

  track.scrollLeft = 0;

  function setActiveDot(idx) {
    const dots = dotsWrap.querySelectorAll(".dot");
    dots.forEach((d, i) => d.classList.toggle("is-active", i === idx));
  }

  track.onscroll = () => {
    if (!hasMany) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    setActiveDot(idx);
  };

  const go = (dir) => {
    if (!hasMany) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth) + dir;
    const clamped = Math.max(0, Math.min(idx, photos.length - 1));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };

  if (prev) prev.onclick = (e) => { e.stopPropagation(); go(-1); };
  if (next) next.onclick = (e) => { e.stopPropagation(); go(1); };
}

/* =========================
   Testimonials (Homepage modal)
========================= */
const TESTIMONIALS = {
  "Honey Soap": [
    "“So gentle and leaves my skin feeling super soft.”",
    "“Smells amazing — perfect for sensitive skin.”",
  ],
  "Coconut Soap": [
    "“Clean, fresh, and the texture is so nice.”",
    "“My favorite for daily use. Feels high quality.”",
  ],
  "Lavender Soap": [
    "“Relaxing scent without being overpowering.”",
    "“Looks beautiful and feels luxurious.”",
  ],
};

function fillTestimonials(soapName) {
  const box = document.getElementById("modal-testimonials");
  if (!box) return;

  const quotes = TESTIMONIALS[soapName] || [];
  box.innerHTML = quotes.slice(0, 2).map(q => `<p class="quote">${q}</p>`).join("");
}

/* =========================
   Card UI
========================= */
function updateOneCardUI(name) {
  const soap = soaps[name];
  const card = document.querySelector(`.gallery-item[data-name="${name}"]`);
  if (!soap || !card) return;

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

  // Out-of-stock styling
  if (!soap.inStock) card.classList.add("out");
  else card.classList.remove("out");
}

function fillAllCards(items) {
  items.forEach((item) => {
    const name = item.dataset.name;
    const soap = soaps[name];
    if (!soap) return;

    // Keep overlay neat (no ingredients hover)
    const overlay = item.querySelector(".overlay");
    //if (overlay) overlay.innerHTML = `Tap to view details`;

    updateOneCardUI(name);
  });
}

/* =========================
   Main
========================= */
document.addEventListener("DOMContentLoaded", () => {
  // Stop rating-link clicks from also opening the modal
  document.addEventListener("click", (e) => {
    const link = e.target.closest(".rating-link");
    if (link) e.stopPropagation();
  });

  // Silent anon auth only on non /soaps pages (home/shop)
  if (!IS_SOAP_PAGE) {
    ensureAnonAuth();
  }

  const items = document.querySelectorAll(".gallery-item");

  // ----- Modal elements -----
  const modal = document.getElementById("soap-modal");
  const nameEl = document.getElementById("modal-name");
  const ingredientsEl = document.getElementById("modal-ingredients");
  const priceEl = document.getElementById("modal-price");
  const ratingEl = document.getElementById("modal-rating");
  const stockEl = document.getElementById("modal-stock");
  const closeModalBtn = document.getElementById("close-modal") || document.querySelector(".close-btn");

  // Shop-only modal controls (might not exist on homepage)
  const totalEl = document.getElementById("modal-total");
  const countEl = document.getElementById("count");
  const plusBtn = document.getElementById("plus");
  const minusBtn = document.getElementById("minus");
  const addToCartBtn = document.getElementById("add-to-cart");

  // Homepage-only extras
  const modalShopLink = document.getElementById("modal-shop-link");

  // ----- Cart elements (SHOP ONLY) -----
  const cartBtn = document.getElementById("cart-btn");
  const cartCountEl = document.getElementById("cart-count");
  const cartTotalEl = document.getElementById("cart-total");
  const cartModal = document.getElementById("cart-modal");
  const cartItemsEl = document.getElementById("cart-items");
  const closeCartBtn = document.getElementById("close-cart");
  const checkoutBtn = document.getElementById("checkout-btn");

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
    if (cartCountEl) cartCountEl.textContent = totalItems;
    if (cartTotalEl) cartTotalEl.textContent = totalPrice.toFixed(2);
    saveCartToStorage();
  }

  function renderCart() {
    if (!cartItemsEl) return;
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

    const itemsTotalEl = document.getElementById("cart-items-total");
    const priceTotalEl = document.getElementById("cart-price-total");
    if (itemsTotalEl) itemsTotalEl.textContent = totalItems;
    if (priceTotalEl) priceTotalEl.textContent = totalPrice.toFixed(2);

    updateCartButton();
  }

  function openModalFor(name) {
    const soap = soaps[name];
    if (!soap) return;

    currentSoap = soap;
    currentSoapName = name;
    count = 1;

    if (nameEl) nameEl.textContent = name;

    // Carousel + ingredients + price
    setModalCarousel(name);
    if (ingredientsEl) {
      ingredientsEl.innerHTML = `<strong>Ingredients:</strong> ${soap.ingredients.join(", ")}`;
    }
    if (priceEl) priceEl.textContent = soap.price.toFixed(2);

    // Homepage: testimonials + link to full soap page
    if (IS_HOME) {
      fillTestimonials(name);
      if (modalShopLink) modalShopLink.href = `/soaps/${soapIdFromName(name)}`;
    }

    // Shop: initialize qty/total if present
    if (countEl) countEl.textContent = String(count);
    if (totalEl) totalEl.textContent = (count * soap.price).toFixed(2);

    // Stop previous Firestore watcher
    if (unwatchSoap) unwatchSoap();

    // Live sync rating + stock from Firestore
    unwatchSoap = watchSoapDoc(name, ({ avg, count: cnt, stock }) => {
      soap.ratingAvg = avg;
      soap.ratingCount = cnt;
      soap.stock = stock;

      if (stockEl) {
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
      }

      function renderStars(avg){
        const full = Math.round(avg);
        return "★★★★★☆☆☆☆☆".slice(5 - full, 10 - full);
      }
      
      if (ratingEl) {
        const count = Number(soap.ratingCount || 0);
        const avg = Number(soap.ratingAvg || 0);
      
        if (count === 0) {
          ratingEl.textContent = "New";
        } else {
          ratingEl.innerHTML = `
            <span style="color:#f5b301;font-size:18px;letter-spacing:1px;">
              ${renderStars(avg)}
            </span>
            <span style="opacity:.8;"> (${count})</span>
          `;
        }
      }

      updateOneCardUI(name);

      // Clamp quantity on shop page
      if (IS_SHOP && count > stock) {
        count = Math.max(1, stock);
        if (countEl) countEl.textContent = String(count);
        if (totalEl) totalEl.textContent = (count * soap.price).toFixed(2);
      }
    });

    if (modal) modal.classList.remove("hidden");
  }

  // ----- Gallery clicks -----
  items.forEach((item) => {
    item.addEventListener("click", (e) => {
      // If user clicked the rating link (stars), do NOT open modal
      if (e.target.closest(".rating-link")) return;
  
      const name = item.dataset.name;
      openModalFor(name);
    });
  });  
  
  // ----- Modal close -----
  if (closeModalBtn) {
    closeModalBtn.onclick = () => {
      if (modal) modal.classList.add("hidden");
    };
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  }

  // =========================
  // SHOP-ONLY: quantity + add-to-cart + cart modal + checkout
  // =========================
  if (IS_SHOP) {
    if (plusBtn) {
      plusBtn.onclick = () => {
        if (!currentSoap) return;
        if (count < availableStock(currentSoapName)) {
          count++;
          if (countEl) countEl.textContent = String(count);
          if (totalEl) totalEl.textContent = (count * currentSoap.price).toFixed(2);
        }
      };
    }

    if (minusBtn) {
      minusBtn.onclick = () => {
        if (!currentSoap) return;
        if (count > 1) {
          count--;
          if (countEl) countEl.textContent = String(count);
          if (totalEl) totalEl.textContent = (count * currentSoap.price).toFixed(2);
        }
      };
    }

    if (addToCartBtn) {
      addToCartBtn.addEventListener("click", () => {
        if (!currentSoap) return;

        const name = currentSoapName;
        const available = availableStock(name);
        const addQty = Math.min(count, available);
        if (addQty <= 0) return;

        if (!cart[name]) cart[name] = { price: currentSoap.price, quantity: 0 };
        cart[name].quantity += addQty;

        updateCartButton();
        updateOneCardUI(name);
        if (modal) modal.classList.add("hidden");
      });
    }

    // Cart modal open/close
    if (cartBtn) {
      cartBtn.addEventListener("click", () => {
        renderCart();
        if (cartModal) cartModal.classList.remove("hidden");
      });
    }

    if (closeCartBtn) {
      closeCartBtn.addEventListener("click", () => {
        if (cartModal) cartModal.classList.add("hidden");
      });
    }

    if (cartModal) {
      cartModal.addEventListener("click", (e) => {
        if (e.target === cartModal) cartModal.classList.add("hidden");
      });
    }

    // Cart qty buttons
    if (cartItemsEl) {
      cartItemsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button.qty-btn");
        if (!btn) return;

        const name = btn.dataset.name;
        const action = btn.dataset.action;
        if (!cart[name]) return;

        if (action === "inc") {
          const avail = availableStock(name);
          if (avail > 0) cart[name].quantity += 1;
        }

        if (action === "dec") {
          cart[name].quantity -= 1;
          if (cart[name].quantity <= 0) delete cart[name];
        }

        renderCart();
        updateOneCardUI(name);
      });
    }

    // Restore cart on refresh
    if (loadCartFromStorage()) updateCartButton();

    // Checkout
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", async () => {
        const itemsForStripe = Object.entries(cart).map(([name, v]) => ({
          name,
          quantity: v.quantity,
        }));

        if (itemsForStripe.length === 0) {
          alert("Your cart is empty!");
          return;
        }

        saveCartToStorage();
        localStorage.setItem(RESUME_FLAG_KEY, "1");

        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: itemsForStripe }),
        });

        let data = null;
        try {
          data = await res.json();
        } catch (e) {
          console.error("Checkout: failed to parse JSON response", e);
        }

        if (!res.ok) {
          console.error("Checkout failed:", res.status, data);
          alert(data?.error || `Checkout failed (${res.status}). Please try again.`);
          return;
        }

        if (!data?.url) {
          alert("Checkout failed: missing Stripe URL.");
          return;
        }

        window.location.href = data.url;
      });
    }
  }

  // ----- Initial render -----
  fillAllCards(items);

  // Live update (rating + stock) for all soaps
  for (const name of Object.keys(soaps)) {
    watchSoapDoc(name, ({ avg, count, stock }) => {
      soaps[name].ratingAvg = avg;
      soaps[name].ratingCount = count;
      soaps[name].stock = stock;
      updateOneCardUI(name);
    });
  }
});
