import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { Cents, MenuIssue, MenuItem } from '@shared';

export const CartActions = createActionGroup({
  source: 'Cart',
  events: {
    /** `unitPrice` is the price the user saw, or entered for an open-price item. */
    'Item Added': props<{ item: MenuItem; unitPrice: Cents }>(),
    'Quantity Changed': props<{ lineId: string; quantity: number }>(),
    'Line Removed': props<{ lineId: string }>(),
    'Discount Changed': props<{ discount: Cents }>(),
    Cleared: emptyProps(),
    /** Brings the lines in line with the menu: new prices are taken, lines that cannot be ordered are removed. */
    'Changes Accepted': props<{ issues: { lineId: string; issue: MenuIssue }[] }>(),
  },
});
