import { MAX_QUANTITY } from '@shared';
import { initialCartState } from './cart.reducer';
import type { CartLine, CartState } from './cart.reducer';

const STORAGE_KEY = 'restaurant-ordering.cart.v1';

function isCartLine(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line['lineId'] === 'string' &&
    typeof line['itemId'] === 'string' &&
    typeof line['name'] === 'string' &&
    typeof line['openPrice'] === 'boolean' &&
    Number.isInteger(line['unitPrice']) &&
    Number.isInteger(line['quantity']) &&
    (line['quantity'] as number) >= 1 &&
    (line['quantity'] as number) <= MAX_QUANTITY
  );
}

/** The saved cart, or an empty one if nothing usable was saved (other version, edited by hand, no storage). */
export function loadCart(storage: Pick<Storage, 'getItem'> = globalThis.localStorage): CartState {
  try {
    const saved: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof saved !== 'object' || saved === null) return initialCartState;
    const { lines, discount } = saved as Record<string, unknown>;
    if (!Array.isArray(lines) || !lines.every(isCartLine) || !Number.isInteger(discount) || (discount as number) < 0) {
      return initialCartState;
    }
    return { lines, discount: discount as number };
  } catch {
    return initialCartState;
  }
}

export function saveCart(cart: CartState, storage: Pick<Storage, 'setItem'> = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Storage can be full or disabled (private mode): the cart then lives only in memory.
  }
}
