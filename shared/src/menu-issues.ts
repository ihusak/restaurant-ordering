import type { MenuIssue } from './api';
import type { Cents, MenuItem } from './models';

export interface PricedLine {
  itemId: string;
  openPrice: boolean;
  unitPrice: Cents;
}

/**
 * Why a cart line can no longer be ordered as it is, or null if it can.
 * The server uses it to accept an order and the client to warn before checkout,
 * so both always agree.
 */
export function findMenuIssue(item: MenuItem | undefined, line: PricedLine): MenuIssue | null {
  if (!item) return { itemId: line.itemId, kind: 'removed' };
  if (!item.available) return { itemId: item.id, kind: 'unavailable' };
  if (item.openPrice !== line.openPrice) return { itemId: item.id, kind: 'pricing_changed', openPrice: item.openPrice };
  if (!item.openPrice && item.price !== line.unitPrice) {
    return { itemId: item.id, kind: 'price_changed', expected: line.unitPrice, actual: item.price ?? 0 };
  }
  return null;
}
