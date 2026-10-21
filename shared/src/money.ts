import type { Cents } from './models';

export const MAX_QUANTITY = 99;
export const MAX_OPEN_PRICE: Cents = 100_000;
export const MAX_FIXED_PRICE: Cents = 1_000_000;

export interface OrderTotals {
  subtotal: Cents;
  discount: Cents;
  total: Cents;
}

export function computeTotals(lines: readonly { quantity: number; unitPrice: Cents }[], discount: Cents): OrderTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const applied = Math.min(Math.max(Math.round(discount), 0), subtotal);
  return { subtotal, discount: applied, total: subtotal - applied };
}

export function isValidCents(value: unknown, max: Cents): value is Cents {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max;
}
