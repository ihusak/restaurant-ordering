import type { MenuSeed } from './menu-store';

/** Small deterministic PRNG so every server start produces the same menu. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: [name: string, dishes: string[]][] = [
  ['Breakfast', ['Omelette', 'Pancakes', 'Granola Bowl', 'Eggs Benedict', 'Waffles', 'Shakshuka']],
  ['Soups', ['Borscht', 'Minestrone', 'Tom Yum', 'Ramen', 'Gazpacho', 'Chowder']],
  ['Salads', ['Caesar', 'Greek Salad', 'Caprese', 'Nicoise', 'Tabbouleh', 'Cobb Salad']],
  ['Starters', ['Bruschetta', 'Croquettes', 'Spring Rolls', 'Hummus Plate', 'Calamari', 'Dumplings']],
  ['Pizza', ['Margherita', 'Pepperoni', 'Quattro Formaggi', 'Diavola', 'Capricciosa', 'Marinara']],
  ['Pasta', ['Carbonara', 'Bolognese', 'Arrabbiata', 'Pesto Linguine', 'Lasagna', 'Gnocchi']],
  ['Burgers', ['Cheeseburger', 'Smash Burger', 'Chicken Burger', 'Veggie Burger', 'BBQ Burger', 'Fish Burger']],
  ['Grill', ['Ribeye', 'Lamb Chops', 'Pork Ribs', 'Chicken Skewers', 'Sausages', 'Halloumi']],
  ['Seafood', ['Salmon Fillet', 'Sea Bass', 'Shrimp Skillet', 'Mussels', 'Tuna Steak', 'Octopus']],
  ['Asian', ['Pad Thai', 'Bibimbap', 'Teriyaki Bowl', 'Fried Rice', 'Katsu Curry', 'Pho']],
  ['Sushi', ['Maki Roll', 'Nigiri Set', 'Uramaki', 'Temaki', 'Sashimi', 'Poke Bowl']],
  ['Vegan', ['Buddha Bowl', 'Falafel Wrap', 'Lentil Curry', 'Tofu Stir-fry', 'Stuffed Peppers', 'Mushroom Risotto']],
  ['Sides', ['Fries', 'Mashed Potatoes', 'Grilled Vegetables', 'Rice', 'Coleslaw', 'Onion Rings']],
  ['Sauces', ['Garlic Aioli', 'Chimichurri', 'Salsa Verde', 'Tzatziki', 'Sriracha Mayo', 'Pesto']],
  ['Kids Menu', ['Mini Burger', 'Nuggets', 'Fish Fingers', 'Mac and Cheese', 'Mini Pizza', 'Pasta Butter']],
  ['Desserts', ['Cheesecake', 'Tiramisu', 'Brownie', 'Panna Cotta', 'Creme Brulee', 'Apple Pie']],
  ['Ice Cream', ['Vanilla Scoop', 'Chocolate Scoop', 'Sorbet', 'Sundae', 'Affogato', 'Gelato Trio']],
  ['Bakery', ['Croissant', 'Cinnamon Roll', 'Focaccia', 'Bagel', 'Muffin', 'Sourdough Slice']],
  ['Coffee', ['Espresso', 'Cappuccino', 'Flat White', 'Latte', 'Cold Brew', 'Mocha']],
  ['Tea', ['Green Tea', 'Earl Grey', 'Chai Latte', 'Matcha', 'Herbal Infusion', 'Iced Tea']],
  ['Smoothies', ['Berry Smoothie', 'Mango Lassi', 'Green Smoothie', 'Banana Shake', 'Protein Shake', 'Acai Blend']],
  ['Juices', ['Orange Juice', 'Apple Juice', 'Carrot Juice', 'Lemonade', 'Grapefruit Juice', 'Ginger Shot']],
  ['Soft Drinks', ['Cola', 'Tonic', 'Ginger Ale', 'Sparkling Water', 'Still Water', 'Kombucha']],
  ['Specials', ['Catch of the Day', "Chef's Tasting", 'Market Vegetables', 'Seasonal Plate', 'Butcher Cut', 'Daily Pie']],
];

const STYLES = [
  'Classic', 'Spicy', 'Smoked', 'Crispy', 'Homemade', 'Rustic', 'Truffle', 'Garden', 'Golden', 'Royal',
  'Mediterranean', 'Nordic', 'Tuscan', 'Alpine', 'Coastal', 'Double', 'Mini', 'Grand', 'Wild', 'Honey',
  'Lemon', 'Herb', 'Pepper', 'Sesame', 'Chili', 'Ginger', 'Maple', 'Basil', 'Charred', 'Signature',
];

const INGREDIENTS = [
  'fresh herbs', 'sea salt', 'roasted garlic', 'parmesan', 'cherry tomatoes', 'baby spinach', 'red onion',
  'lime', 'avocado', 'chili flakes', 'olive oil', 'toasted seeds', 'pickled cucumber', 'mozzarella', 'mint',
  'black pepper', 'cream', 'mushrooms', 'paprika', 'coriander',
];

/** ~3,000 items across 24 categories. */
export function generateMenu(itemsPerCategory = 125, seed = 42): MenuSeed {
  const random = mulberry32(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
  const seedData: MenuSeed = { categories: [], items: [] };
  let itemNumber = 0;

  CATEGORIES.forEach(([name, dishes], index) => {
    const categoryId = `cat-${String(index + 1).padStart(2, '0')}`;
    seedData.categories.push({ id: categoryId, name, sortOrder: index + 1 });

    const combinations = STYLES.flatMap((style) => dishes.map((dish) => `${style} ${dish}`));
    const count = Math.min(itemsPerCategory, combinations.length);
    for (let i = 0; i < count; i++) {
      const offset = Math.floor(random() * combinations.length);
      const [itemName] = combinations.splice(offset, 1);
      const openPrice = name === 'Specials' ? random() < 0.5 : random() < 0.01;
      itemNumber++;
      seedData.items.push({
        id: `item-${String(itemNumber).padStart(4, '0')}`,
        categoryId,
        name: itemName ?? `Dish ${itemNumber}`,
        description: `With ${pick(INGREDIENTS)}, ${pick(INGREDIENTS)} and ${pick(INGREDIENTS)}.`,
        openPrice,
        // Prices end in 0 or 5 cents, from 1.50 to 39.95.
        price: openPrice ? null : 150 + Math.floor(random() * 770) * 5,
        available: random() > 0.07,
      });
    }
  });
  return seedData;
}
