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