import { createSelector } from '@ngrx/store';
import { findMenuIssue } from '@shared';
import type { MenuIssue } from '@shared';
import { cartFeature } from '../cart/cart.reducer';
import type { CartLine } from '../cart/cart.reducer';
import { menuFeature } from '../menu/menu.reducer';
import { checkoutFeature } from './checkout.reducer';

export interface LineIssue {
  lineId: string;
  issue: MenuIssue;
}

/** A price change only concerns fixed-price lines; the rest concern every line of the item. */
function concerns(issue: MenuIssue, line: CartLine): boolean {
  return issue.itemId === line.itemId && (issue.kind !== 'price_changed' || !line.openPrice);
}

/**
 * Cart lines that can no longer be ordered as they are, checked against the
 * live menu with the same rule the server applies. Changes the server reported
 * in a 409 count as well, in case the live menu has not caught up yet.
 */
export const selectCartReview = createSelector(
  cartFeature.selectLines,
  menuFeature.selectItemEntities,
  menuFeature.selectEpoch,
  checkoutFeature.selectIssues,
  (lines, items, epoch, reported): LineIssue[] => {
    const review: LineIssue[] = [];
    for (const line of lines) {
      // Before the first menu load, a missing item means nothing yet.
      const live = epoch === null ? null : findMenuIssue(items[line.itemId], line);
      const issue = live ?? reported.find((candidate) => concerns(candidate, line));
      if (issue) review.push({ lineId: line.lineId, issue });
    }
    return review;
  },
);
