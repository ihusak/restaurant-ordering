import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { MAX_QUANTITY, computeTotals } from '@shared';
import type { Cents, CreateOrderRequest } from '@shared';
import { CheckoutActions } from '../checkout/checkout.actions';
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
  /** Sent with every attempt to place this cart, so a retry cannot create a second order. */
  idempotencyKey: string | null;
  /** The last attempt got no answer: an order may exist under the key, so the key must be kept. */
  outcomeUnknown: boolean;
}

export const initialCartState: CartState = { lines: [], discount: 0, idempotencyKey: null, outcomeUnknown: false };

/**
 * A changed cart is a different order and gets a new key, unless the last
 * attempt may have succeeded: then the old key makes the server refuse to
 * place a second order instead of silently creating one.
 */
function edited(state: CartState, changes: Partial<Pick<CartState, 'lines' | 'discount'>>): CartState {
  return { ...state, ...changes, idempotencyKey: state.outcomeUnknown ? state.idempotencyKey : null };
}

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
        return edited(state, {
          lines: state.lines.map((line) =>
            line === existing ? { ...line, quantity: clampQuantity(line.quantity + 1) } : line,
          ),
        });
      }
      const line: CartLine = { lineId, itemId: item.id, name: item.name, openPrice: item.openPrice, unitPrice, quantity: 1 };
      return edited(state, { lines: [...state.lines, line] });
    }),
    on(CartActions.quantityChanged, (state, { lineId, quantity }): CartState => {
      const next = clampQuantity(quantity);
      return edited(state, {
        lines:
          next === 0
            ? state.lines.filter((line) => line.lineId !== lineId)
            : state.lines.map((line) => (line.lineId === lineId ? { ...line, quantity: next } : line)),
      });
    }),
    on(CartActions.lineRemoved, (state, { lineId }): CartState =>
      edited(state, { lines: state.lines.filter((line) => line.lineId !== lineId) }),
    ),
    on(CartActions.discountChanged, (state, { discount }): CartState =>
      edited(state, { discount: Math.max(0, Math.round(discount)) }),
    ),
    on(CartActions.cleared, (state): CartState => edited(state, { lines: [], discount: 0 })),
    on(CartActions.changesAccepted, (state, { issues }): CartState => {
      const byLine = new Map(issues.map(({ lineId, issue }) => [lineId, issue]));
      const lines: CartLine[] = [];
      for (const line of state.lines) {
        const issue = byLine.get(line.lineId);
        if (!issue) lines.push(line);
        else if (issue.kind === 'price_changed') lines.push({ ...line, unitPrice: issue.actual });
        // Removed, unavailable, or the pricing kind changed: the line cannot be kept as it is.
      }
      return edited(state, { lines });
    }),
    on(CheckoutActions.submitted, (state, { newKey }): CartState => ({ ...state, idempotencyKey: state.idempotencyKey ?? newKey })),
    on(CheckoutActions.succeeded, (): CartState => initialCartState),
    on(CheckoutActions.menuChanged, (state): CartState => ({ ...state, outcomeUnknown: false })),
    on(CheckoutActions.failed, (state, { failure }): CartState => {
      if (failure === 'unknown') return { ...state, outcomeUnknown: true };
      // The key already holds an order: a new attempt must not reuse it.
      if (failure === 'key-used') return { ...state, idempotencyKey: null, outcomeUnknown: false };
      return { ...state, outcomeUnknown: false };
    }),
  ),
  extraSelectors: ({ selectLines, selectDiscount, selectIdempotencyKey }) => {
    const selectTotals = createSelector(selectLines, selectDiscount, (lines, discount) => computeTotals(lines, discount));
    /** The discount cannot be more than the subtotal: the server refuses such an order. */
    const selectDiscountTooHigh = createSelector(selectTotals, selectDiscount, (totals, discount) => discount > totals.subtotal);
    const selectItemCount = createSelector(selectLines, (lines) => lines.reduce((sum, line) => sum + line.quantity, 0));
    const selectQuantityByItem = createSelector(selectLines, (lines) => {
      const quantities = new Map<string, number>();
      for (const line of lines) quantities.set(line.itemId, (quantities.get(line.itemId) ?? 0) + line.quantity);
      return quantities;
    });
    const selectOrderRequest = createSelector(selectLines, selectDiscount, selectIdempotencyKey, (lines, discount, idempotencyKey) =>
      idempotencyKey === null
        ? null
        : ({
            idempotencyKey,
            lines: lines.map(({ itemId, openPrice, quantity, unitPrice }) => ({ itemId, openPrice, quantity, unitPrice })),
            discount,
          } satisfies CreateOrderRequest),
    );
    return { selectTotals, selectDiscountTooHigh, selectItemCount, selectQuantityByItem, selectOrderRequest };
  },
});
