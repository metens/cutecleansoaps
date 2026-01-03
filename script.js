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

items.forEach(item => {
    item.addEventListener("click", () => {
        const name = item.dataset.name;
        const soap = soaps[name];

        if (!soap) {
            alert("No data available for " + name);
            return;
        }

        const ingredientList = soap.ingredients.join(", ");

        alert(
            `The ingredients for ${name} are:\n${ingredientList}\n\nPrice: $${soap.price}`
        );
    });
});

