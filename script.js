const cart = {}; // { "Cinnamon Soap": { price: 6.99, quantity: 2 } }

// Soap class
class Soap {
    constructor(ingredients, price) {
        this.ingredients = ingredients;
        this.price = price;
    }
}

// Soap database
const soaps = {
    "Cinnamon Soap": new Soap(
        ["Olive oil", "Coconut oil", "Cinnamon", "Lye"],
        6.99
    ),
    "Coconut Soap": new Soap(
        ["Coconut oil", "Shea butter", "Lye"],
        5.99
    ),
    "Honey Soap": new Soap(
        ["Honey", "Olive oil", "Oat milk", "Lye"],
        6.49
    ),
    "Lavander Soap": new Soap(
        ["Lavander", "Olive Oil", "Lye", "Sugar"],
        4.99
    ),
    "Olive Soap": new Soap(
        ["Olive oil", "Rosemary", "Thyme", "Lye"],
        7.99
    ),
    "Citrus Soap": new Soap(
        ["Olive oil", "Orange Juice", "Lemon Skin", "Lye"],
        4.99
    ),
    "Rose Soap": new Soap(
        ["Rose Pedals", "Olive oil", "Rose Essential Oil", "Lye"],
        6.49
    ),
    "Oatmeal Soap": new Soap(
        ["Oatmeal", "Coconut Oil", "Lye", "Brown Sugar"],
        5.74
    ),
    "Aloe Vera Soap": new Soap(
        ["Aloe Vera Leaves", "Lye"],
        6.49
    ),
    "Shea Soap": new Soap(
        ["Shea", "Coconut Butter", "Lye", "Almonds"],
        5.99
    )
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
        <span>Ingredients:</span>
        <small>${soap.ingredients.join(", ")}</small>
        <span>Price: $${soap.price.toFixed(2)}</span>
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
});

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

// Fake add to cart (for now)
/*document.getElementById("add-to-cart").onclick = () => {
  alert(`Added ${count} to cart!`);
  modal.classList.add("hidden");
};*/
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
          <span>${name} × ${item.quantity}</span>
          <span>$${lineTotal.toFixed(2)}</span>
        `;
            cartItemsEl.appendChild(row);
        }

        document.getElementById("cart-items-total").textContent = totalItems;
        document.getElementById("cart-price-total").textContent = totalPrice.toFixed(2);
    }

    // ====== Add to Cart (from soap modal) ======
    addToCartBtn.addEventListener("click", () => {
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

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("checkout-btn");

    btn.addEventListener("click", async () => {
        console.log("✅ checkout clicked");

        const items = Object.entries(cart).map(([name, v]) => ({ name, quantity: v.quantity }));
        console.log("items being sent:", items);

        try {
            const res = await fetch("/.netlify/functions/create-checkout-session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });

            console.log("status:", res.status);
            const data = await res.json();
            console.log("response:", data);

            if (data.url) window.location.href = data.url;
            else alert(data.error || "Checkout failed");
        } catch (e) {
            console.log("❌ fetch failed:", e);
            alert("Checkout failed — open Console for details.");
        }
    });
});

/*
document.getElementById("checkout-btn").addEventListener("click", async () => {
  const items = Object.entries(cart).map(([name, v]) => ({ name, quantity: v.quantity }));
 
  const res = await fetch("/.netlify/functions/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
 
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert(data.error || "Checkout failed");
});
*/