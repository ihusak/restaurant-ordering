import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { MAX_QUANTITY, computeTotals } from '@shared';
import type { Cents } from '@shared';
import { CartActions } from './cart.actions';

export interface CartLine {
  lineId: string;
  itemId: string;
  /** Name at the moment of adding, so the line stays readable if the item is renamed or removed. */
  name: string;
  openPrice: boolean;
  unitPrice: Cents;
  quantity: number;
}

export interface CartState {
  lines: CartLine[];
  discount: Cents;
}

export const initialCartState: CartState = { lines: [], discount: 0 };

/** A fixed-price item has one line; an open-price item has one line per entered price. */
export function lineIdFor(itemId: string, openPrice: boolean, unitPrice: Cents): string {
  return openPrice ? `${itemId}@${unitPrice}` : itemId;
}

const clampQuantity = (quantity: number): number => Math.min(Math.max(Math.trunc(quantity), 0), MAX_QUANTITY);

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    initialCartState,
    on(CartActions.itemAdded, (state, { item, unitPrice }): CartState => {
      const lineId = lineIdFor(item.id, item.openPrice, unitPrice);
      const existing = state.lines.find((line) => line.lineId === lineId);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((line) =>
            line === existing ? { ...line, quantity: clampQuantity(line.quantity + 1) } : line,
          ),
        };
      }
      const line: CartLine = { lineId, itemId: item.id, name: item.name, openPrice: item.openPrice, unitPrice, quantity: 1 };
      return { ...state, lines: [...state.lines, line] };
    }),
    on(CartActions.quantityChanged, (state, { lineId, quantity }): CartState => {
      const next = clampQuantity(quantity);
      return {
        ...state,
        lines:
          next === 0
            ? state.lines.filter((line) => line.lineId !== lineId)
            : state.lines.map((line) => (line.lineId === lineId ? { ...line, quantity: next } : line)),
      };
    }),
    on(CartActions.lineRemoved, (state, { lineId }): CartState => ({
      ...state,
      lines: state.lines.filter((line) => line.lineId !== lineId),
    })),
    on(CartActions.discountChanged, (state, { discount }): CartState => ({ ...state, discount: Math.max(0, Math.round(discount)) })),
    on(CartActions.cleared, (): CartState => initialCartState),
  ),
  extraSelectors: ({ selectLines, selectDiscount }) => {
    const selectTotals = createSelector(selectLines, selectDiscount, (lines, discount) => computeTotals(lines, discount));
    /** The discount cannot be more than the subtotal: the server refuses such an order. */
    const selectDiscountTooHigh = createSelector(selectTotals, selectDiscount, (totals, discount) => discount > totals.subtotal);
    const selectItemCount = createSelector(selectLines, (lines) => lines.reduce((sum, line) => sum + line.quantity, 0));
    const selectQuantityByItem = createSelector(selectLines, (lines) => {
      const quantities = new Map<string, number>();
      for (const line of lines) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
      return quantities;
    });
    return { selectTotals, selectDiscountTooHigh, selectItemCount, selectQuantityByItem };
  },
});
