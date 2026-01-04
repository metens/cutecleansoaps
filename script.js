const cart = {}; // { "Cinnamon Soap": { price: 6.99, quantity: 2 } }

// Soap class
class Soap {
    constructor(ingredients, price, inStock = true) {
        this.ingredients = ingredients;
        this.price = price;
        this.inStock = inStock;
    }
}

// Soap database
const soaps = {
    "Cinnamon Soap": new Soap(
        ["Olive oil", "Coconut oil", "Cinnamon", "Lye"],
        4.00,
        false
    ),
    "Coconut Soap": new Soap(
        ["Coconut oil", "Shea butter", "Lye"],
        4.00,
        false
    ),
    "Honey Soap": new Soap(
        ["Honey", "Olive oil", "Oat milk", "Lye"],
        5.00,
        false
    ),
    "Lavender Soap": new Soap(
        ["Lavender", "Olive Oil", "Lye", "Sugar"],
        5.00,
        true
    ),
    "Olive Soap": new Soap(
        ["Olive oil", "Rosemary", "Thyme", "Lye"],
        6.00,
        false
    ),
    "Citrus Soap": new Soap(
        ["Olive oil", "Orange Juice", "Lemon Skin", "Lye"],
        4.00,
        false
    ),
    "Rose Soap": new Soap(
        ["Rose Pedals", "Olive oil", "Rose Essential Oil", "Lye"],
        4.00,
        false
    ),
    "Oatmeal Soap": new Soap(
        ["Oatmeal", "Goat Milk", "Lye", "Brown Sugar", "Coconut Oil"],
        5.00,
        true
    ),
    "Aloe Vera Soap": new Soap(
        ["Aloe Vera Leaves", "Lye"],
        4.00,
        false
    ),
    "Shea Soap": new Soap(
        ["Shea", "Coconut Butter", "Lye", "Almonds"],
        4.00,
        false
    ),
    "Vanilla Chai Soap": new Soap(
        ["Vanilla Oil", "Nutmeg", "Ground Ginger", "Cinnamon Oil", "Lye"],
        5.00,
        false
    ),
};

// Click handlers
const items = document.querySelectorAll(".gallery-item");

document.addEventListener("DOMContentLoaded", () => {
    const items = document.querySelectorAll(".gallery-item");

    // Fill overlays from JS data
    items.forEach(item => {
        const name = item.dataset.name;
        const soap = soaps[name];
        const overlay = item.querySelector(".overlay");
        if (!soap || !overlay) return;

        overlay.innerHTML = `
        <strong>${name}</strong>
        <small>${soap.ingredients.join(", ")}</small>
        <span>Price: $${soap.price.toFixed(2)}</span>
        ${!soap.inStock
            ? `<span class="out-of-stock">Out of Stock</span>`
            : ``
        }
`;
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

let currentSoap = null;
let count = 1;

// Open modal on soap click
document.querySelectorAll(".gallery-item").forEach(item => {
    item.addEventListener("click", () => {
      const name = item.dataset.name;
      const soap = soaps[name];
  
      if (!soap || !soap.inStock) return; // 🚫 block click
  
      currentSoap = soap;
      count = 1;
      nameEl.textContent = name;
      ingredientsEl.textContent = "Ingredients: " + soap.ingredients.join(", ");
      priceEl.textContent = soap.price.toFixed(2);
      countEl.textContent = count;
      totalEl.textContent = (count * soap.price).toFixed(2);
      modal.classList.remove("hidden");
    });
  });
/*document.querySelectorAll(".gallery-item").forEach(item => {
    item.addEventListener("click", () => {
        const name = item.dataset.name;
        currentSoap = soaps[name];
        if (!currentSoap) return;

        count = 1;
        nameEl.textContent = name;
        ingredientsEl.textContent =
            "Ingredients: " + currentSoap.ingredients.join(", ");
        priceEl.textContent = currentSoap.price.toFixed(2);
        countEl.textContent = count;
        totalEl.textContent = (count * currentSoap.price).toFixed(2);

        modal.classList.remove("hidden");
    });
});*/

// Quantity buttons
document.getElementById("plus").onclick = () => {
    count++;
    countEl.textContent = count;
    totalEl.textContent = (count * currentSoap.price).toFixed(2);
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
      
        renderCart(); // re-draw rows + totals
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

        const name = nameEl.textContent; // from your soap modal code

        if (!cart[name]) {
            cart[name] = { price: currentSoap.price, quantity: 0 };
        }
        cart[name].quantity += count;

        updateCartButton();
        modal.classList.add("hidden"); // your soap modal
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
});

document.getElementById("checkout-btn").addEventListener("click", async () => {
    const items = Object.entries(cart).map(([name, v]) => ({
        name,
        quantity: v.quantity
    }));

    const FUNCTION_BASE = "https://tubular-centaur-3dbb72.netlify.app";

    const res = await fetch(`${FUNCTION_BASE}/.netlify/functions/create-checkout-session`, {
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