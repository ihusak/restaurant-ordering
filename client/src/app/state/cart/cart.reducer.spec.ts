import { menuItem } from '../../../testing/fixtures';
import { CartActions } from './cart.actions';
import { cartFeature, initialCartState } from './cart.reducer';
import type { CartState } from './cart.reducer';

const reduce = (...actions: Parameters<typeof cartFeature.reducer>[1][]): CartState =>
  actions.reduce(cartFeature.reducer, initialCartState);
const root = (cart: CartState) => ({ cart });

const pizza = menuItem({ id: 'pizza', name: 'Pizza', price: 1250 });
const special = menuItem({ id: 'special', name: 'Special', openPrice: true, price: null });
const addPizza = CartActions.itemAdded({ item: pizza, unitPrice: 1250 });

describe('cart reducer', () => {
  it('adds a fixed-price item once and counts further adds', () => {
    const state = reduce(addPizza, addPizza);
    expect(state.lines).toEqual([
      { lineId: 'pizza', itemId: 'pizza', name: 'Pizza', openPrice: false, unitPrice: 1250, quantity: 2 },
    ]);
  });

  it('keeps open-price items with different prices on separate lines', () => {
    const state = reduce(
      CartActions.itemAdded({ item: special, unitPrice: 900 }),
      CartActions.itemAdded({ item: special, unitPrice: 1500 }),
      CartActions.itemAdded({ item: special, unitPrice: 900 }),
    );
    expect(state.lines.map((line) => [line.lineId, line.quantity])).toEqual([
      ['special@900', 2],
      ['special@1500', 1],
    ]);
  });

  it('limits the quantity to 1..99 and removes a line set to zero', () => {
    const many = reduce(addPizza, CartActions.quantityChanged({ lineId: 'pizza', quantity: 500 }));
    expect(many.lines[0]?.quantity).toBe(99);
    expect(cartFeature.reducer(many, addPizza).lines[0]?.quantity).toBe(99);
    expect(cartFeature.reducer(many, CartActions.quantityChanged({ lineId: 'pizza', quantity: 0 })).lines).toEqual([]);
  });

  it('removes a line and clears the cart', () => {
    const state = reduce(addPizza, CartActions.itemAdded({ item: special, unitPrice: 900 }), CartActions.discountChanged({ discount: 100 }));
    expect(cartFeature.reducer(state, CartActions.lineRemoved({ lineId: 'pizza' })).lines.map((line) => line.lineId)).toEqual([
      'special@900',
    ]);
    expect(cartFeature.reducer(state, CartActions.cleared())).toEqual(initialCartState);
  });
});

describe('cart selectors', () => {
  const cart = reduce(
    addPizza,
    addPizza,
    CartActions.itemAdded({ item: special, unitPrice: 900 }),
    CartActions.itemAdded({ item: special, unitPrice: 1500 }),
    CartActions.discountChanged({ discount: 400 }),
  );

  it('computes the totals in cents with the shared formula', () => {
    expect(cartFeature.selectTotals(root(cart))).toEqual({ subtotal: 4900, discount: 400, total: 4500 });
  });

  it('counts items and the quantity of each menu item', () => {
    expect(cartFeature.selectItemCount(root(cart))).toBe(4);
    expect(cartFeature.selectQuantityByItem(root(cart))).toEqual(
      new Map([
        ['pizza', 2],
        ['special', 2],
      ]),
    );
  });

  it('flags a discount above the subtotal instead of hiding it', () => {
    const tooMuch = cartFeature.reducer(cart, CartActions.discountChanged({ discount: 6000 }));
    expect(cartFeature.selectDiscountTooHigh(root(tooMuch))).toBe(true);
    expect(cartFeature.selectDiscountTooHigh(root(cart))).toBe(false);
  });
});
