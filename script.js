const cart = {}; // { "Cinnamon Soap": { price: 6.99, quantity: 2 } }

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

        // clear current cart + copy saved items in
        for (const k in cart) delete cart[k];
        for (const name in saved) cart[name] = saved[name];
        return true;
    } catch {
        return false;
    }
}


// Soap class

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



// Soap database
const soaps = {
    "Cinnamon Soap": new Soap(
        ["Coconut oil", "Cinnamon Oil", "Lye"],
        6.00,   // price
        5,      // stock
        0,      // average rating
        0       // total ratings
    ),
    "Coconut Soap": new Soap(
        ["Coconut oil", "Shea butter", "Lye"],
        6.00,
        0,
        0,
        0
    ),
    "Almond Shea Soap": new Soap(
        ["Almonds", "Coconut oil", "Cinnamon", "Vanilla", "Lye"],
        8.00,
        12,
        5,
        0
    ),
    "Honey Soap": new Soap(
        ["Honey", "Olive oil", "Oat milk", "Lye"],
        8.00,
        0,
        0,
        0,
    ),
    "Lavender Soap": new Soap(
        ["Lavender", "Olive Oil", "Lye", "Sugar"],
        8.00,
        7,
        0,
        0
    ),
    "Citrus Soap": new Soap(
        ["Olive oil", "Orange Juice", "Lemon Skin", "Lye"],
        6.00,
        0,
        0,
        0
    ),
    "Rose Pedal Soap": new Soap(
        ["Rose Pedals", "Olive oil", "Rose Essential Oil", "Lye"],
        7.00,
        0,
        0,
        0,
    ),
    "Oatmeal Soap": new Soap(
        ["Oatmeal", "Goat Milk", "Lye", "Brown Sugar", "Coconut Oil"],
        6.00,
        10,
        0,
        0
    ),
};

// Click handlers
const items = document.querySelectorAll(".gallery-item");

document.addEventListener("DOMContentLoaded", () => {
    const items = document.querySelectorAll(".gallery-item");

    // Fill overlays + meta from JS data
items.forEach(item => {
    const name = item.dataset.name;
    const soap = soaps[name];
    const overlay = item.querySelector(".overlay");
    const meta = item.querySelector(".meta-line");
  
    if (!soap) return;
  
    // Overlay (hover / tap bonus)
    if (overlay) {
      overlay.innerHTML = `
        <strong>${name}</strong>
        <small>${soap.ingredients.join(", ")}</small>
        <span>Price: $${soap.price.toFixed(2)}</span>
      `;
    }
  
    // Meta line (always visible — mobile safe)
    if (meta) {
      const stars =
        soap.ratingCount > 0
          ? `⭐ ${soap.ratingAvg.toFixed(1)} (${soap.ratingCount})`
          : "⭐ New";
  
      const stockText =
        soap.stock > 0 ? `${soap.stock} left` : "Out of stock";
  
      const lowStockClass =
        soap.stock > 0 && soap.stock <= 3 ? "low" : "";
  
      meta.innerHTML = `
        ${stars} • <span class="${lowStockClass}">${stockText}</span>
      `;
    }
  });

        // Tap-to-toggle for touch devices
    const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

    if (isTouch) {
        // Close when tapping outside any item
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".gallery-item")) {
                items.forEach(i => i.classList.remove("is-open"));
            }
        });

        // Toggle when tapping an item
        items.forEach(item => {
            item.addEventListener("click", (e) => {
                e.stopPropagation();

                const currentlyOpen = item.classList.contains("is-open");
                items.forEach(i => i.classList.remove("is-open"));
                if (!currentlyOpen) item.classList.add("is-open");
            });
        });
    }
});

const modal = document.getElementById("soap-modal");
const nameEl = document.getElementById("modal-name");
const ingredientsEl = document.getElementById("modal-ingredients");
const priceEl = document.getElementById("modal-price");
const totalEl = document.getElementById("modal-total");
const countEl = document.getElementById("count");
const ratingEl = document.getElementById("modal-rating");
const stockEl = document.getElementById("modal-stock");


let currentSoap = null;
let count = 1;

// Open modal on soap click
document.querySelectorAll(".gallery-item").forEach(item => {
    item.addEventListener("click", () => {
      const name = item.dataset.name;
      const soap = soaps[name];
      if (!soap || !soap.inStock) return;
  
      currentSoap = soap;
      count = 1;
  
      nameEl.textContent = name;
      ingredientsEl.textContent = "Ingredients: " + soap.ingredients.join(", ");
      priceEl.textContent = soap.price.toFixed(2);
      countEl.textContent = count;
      totalEl.textContent = (count * soap.price).toFixed(2);
  
      // ✅ update rating + stock INSIDE the click
      const starText =
        soap.ratingCount > 0
          ? `⭐ ${soap.ratingAvg.toFixed(1)} (${soap.ratingCount})`
          : "⭐ New";
      ratingEl.textContent = starText;
  
      if (soap.stock <= 0) {
        stockEl.textContent = "Out of stock";
        stockEl.style.color = "#c0392b";
      } else if (soap.stock <= 3) {
        stockEl.textContent = `Only ${soap.stock} left!`;
        stockEl.style.color = "#c0392b";
      } else {
        stockEl.textContent = `${soap.stock} in stock`;
        stockEl.style.color = "#333";
      }
  
      modal.classList.remove("hidden");
    });
  });
  


// Quantity buttons
document.getElementById("plus").onclick = () => {
    if (count < currentSoap.stock) {
      count++;
      countEl.textContent = count;
      totalEl.textContent = (count * currentSoap.price).toFixed(2);
    }
};

document.getElementById("minus").onclick = () => {
    if (count > 1) {
        count--;
        countEl.textContent = count;
        totalEl.textContent = (count * currentSoap.price).toFixed(2);
    }
};

// Close modal
document.querySelector(".close-btn").onclick = () => {
    modal.classList.add("hidden");
};

document.querySelectorAll(".gallery-item").forEach(item => {
    const soap = soaps[item.dataset.name];
    if (soap && !soap.inStock) {
        item.classList.add("out");
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // ====== Cart UI elements (these were commented out in yours) ======
    const cartCountEl = document.getElementById("cart-count");
    const cartTotalEl = document.getElementById("cart-total");

    const cartModal = document.getElementById("cart-modal");
    const cartItemsEl = document.getElementById("cart-items");
    const closeCartBtn = document.getElementById("close-cart");
    const cartBtn = document.getElementById("cart-btn");
    const addToCartBtn = document.getElementById("add-to-cart");

    // Safety check (helps you catch missing HTML ids)
    if (!cartCountEl || !cartTotalEl || !cartModal || !cartItemsEl || !cartBtn || !addToCartBtn) {
        console.log("Cart elements missing — check your HTML ids.");
        return;
    }

    cartItemsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("button.qty-btn");
        if (!btn) return;

        const name = btn.dataset.name;
        const action = btn.dataset.action;

        if (!cart[name]) return;

        if (action === "inc") cart[name].quantity += 1;

        if (action === "dec") {
            cart[name].quantity -= 1;
            if (cart[name].quantity <= 0) delete cart[name]; // remove item when it hits 0
        }


        renderCart();

    });



    // ====== Cart data ======

    function updateCartButton() {
        let totalItems = 0;
        let totalPrice = 0;

        for (const name in cart) {
            totalItems += cart[name].quantity;
            totalPrice += cart[name].quantity * cart[name].price;
        }

        cartCountEl.textContent = totalItems;
        cartTotalEl.textContent = totalPrice.toFixed(2);

        // ✅ persist cart on every change
        saveCartToStorage();
    }

    function renderCart() {
        cartItemsEl.innerHTML = "";

        let totalItems = 0;
        let totalPrice = 0;

        for (const name in cart) {
            const item = cart[name];
            const lineTotal = item.quantity * item.price;

            totalItems += item.quantity;
            totalPrice += lineTotal;

            const row = document.createElement("div");
            row.className = "cart-row";

            row.innerHTML = `
            <span class="cart-name">${name}</span>
      
            <div class="cart-qty-controls">
              <button class="qty-btn" data-action="dec" data-name="${name}">−</button>
              <span class="cart-qty">${item.quantity}</span>
              <button class="qty-btn" data-action="inc" data-name="${name}">+</button>
            </div>
      
            <span class="cart-line-total">$${lineTotal.toFixed(2)}</span>
          `;

            cartItemsEl.appendChild(row);
        }

        document.getElementById("cart-items-total").textContent = totalItems;
        document.getElementById("cart-price-total").textContent = totalPrice.toFixed(2);

        updateCartButton();
    }

    // ====== Add to Cart (from soap modal) ======
    addToCartBtn.addEventListener("click", () => {
        if (!currentSoap?.inStock) return;
      
        const name = nameEl.textContent;
      
        const available = currentSoap.stock;
        const addQty = Math.min(count, available);
        if (addQty <= 0) return;
      
        if (!cart[name]) {
          cart[name] = { price: currentSoap.price, quantity: 0 };
        }
      
        cart[name].quantity += addQty;
        currentSoap.stock -= addQty;
      
        updateCartButton();
        modal.classList.add("hidden");
      });
          // ====== Open/close Cart modal ======
    cartBtn.addEventListener("click", () => {
        renderCart();
        cartModal.classList.remove("hidden");
    });

    closeCartBtn?.addEventListener("click", () => {
        cartModal.classList.add("hidden");
    });

    // Optional: click outside modal to close
    cartModal.addEventListener("click", (e) => {
        if (e.target === cartModal) cartModal.classList.add("hidden");
    });

    // Auto-restore cart after cancel "Resume checkout"
    const shouldResume = localStorage.getItem(RESUME_FLAG_KEY) === "1";

    if (shouldResume) {
        const restored = loadCartFromStorage();

        if (restored) {
            updateCartButton();

            // Optional: open cart automatically so they see it
            renderCart();
            cartModal.classList.remove("hidden");
        }

        localStorage.removeItem(RESUME_FLAG_KEY);
    }

    // ✅ restore cart on normal page refresh
    if (loadCartFromStorage()) {
        updateCartButton();
    }

    // Clear cart after "Back to Shop" from cancel page
    if (localStorage.getItem("ccs_clear_cart_on_home") === "1") {
        for (const k in cart) delete cart[k];
        localStorage.removeItem(CART_STORAGE_KEY);
        localStorage.removeItem(RESUME_FLAG_KEY);
        localStorage.removeItem("ccs_clear_cart_on_home");

        updateCartButton();
        cartModal.classList.add("hidden");
    } else {
        // Auto-restore cart after cancel "Resume checkout"
        const shouldResume = localStorage.getItem(RESUME_FLAG_KEY) === "1";
        if (shouldResume) {
            const restored = loadCartFromStorage();
            if (restored) {
                updateCartButton();
                renderCart();
                cartModal.classList.remove("hidden"); // open cart modal
            }
            localStorage.removeItem(RESUME_FLAG_KEY);
        }
    }


});

document.getElementById("checkout-btn").addEventListener("click", async () => {
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
