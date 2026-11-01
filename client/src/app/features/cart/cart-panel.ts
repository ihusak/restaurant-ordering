import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { MAX_QUANTITY } from '@shared';
import type { MenuIssue } from '@shared';
import { centsToInput, formatCents, parsePrice } from '../../core/money';
import { CartActions } from '../../state/cart/cart.actions';
import { cartFeature } from '../../state/cart/cart.reducer';
import type { CartLine } from '../../state/cart/cart.reducer';
import { selectCartReview } from '../../state/checkout/cart-review';
import { CheckoutActions } from '../../state/checkout/checkout.actions';
import { checkoutFeature } from '../../state/checkout/checkout.reducer';
import { connectionFeature } from '../../state/realtime/connection.reducer';

@Component({
  selector: 'app-cart-panel',
  imports: [RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './cart-panel.html',
  styleUrl: './cart-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPanel {
  private readonly store = inject(Store);
  protected readonly maxQuantity = MAX_QUANTITY;
  protected readonly lines = this.store.selectSignal(cartFeature.selectLines);
  protected readonly discount = this.store.selectSignal(cartFeature.selectDiscount);
  protected readonly totals = this.store.selectSignal(cartFeature.selectTotals);
  protected readonly itemCount = this.store.selectSignal(cartFeature.selectItemCount);
  protected readonly discountTooHigh = this.store.selectSignal(cartFeature.selectDiscountTooHigh);
  protected readonly discountFormatError = signal(false);

  protected readonly checkout = this.store.selectSignal(checkoutFeature.selectCheckoutState);
  protected readonly submitting = computed(() => this.checkout().status === 'submitting');
  private readonly online = this.store.selectSignal(connectionFeature.selectBrowserOnline);
  protected readonly review = this.store.selectSignal(selectCartReview);
  private readonly issueByLine = computed(() => new Map(this.review().map(({ lineId, issue }) => [lineId, issue])));
  /** Why the order cannot be placed right now, or null. */
  protected readonly blocker = computed(() => {
    if (!this.online()) return 'You are offline. The order can be placed once the connection is back.';
    if (this.review().length > 0) return 'Accept the menu changes to place the order.';
    if (this.discountTooHigh()) return 'Lower the discount to place the order.';
    return null;
  });

  protected readonly money = formatCents;
  protected readonly discountInput = centsToInput;

  protected setQuantity(line: CartLine, quantity: number): void {
    this.store.dispatch(CartActions.quantityChanged({ lineId: line.lineId, quantity }));
  }

  protected setDiscount(event: Event): void {
    const text = (event.target as HTMLInputElement).value.trim();
    const discount = text === '' ? 0 : parsePrice(text);
    this.discountFormatError.set(discount === null);
    if (discount !== null) this.store.dispatch(CartActions.discountChanged({ discount }));
  }

  protected clear(): void {
    this.discountFormatError.set(false);
    this.store.dispatch(CartActions.cleared());
  }

  protected issueOf(line: CartLine): MenuIssue | undefined {
    return this.issueByLine().get(line.lineId);
  }

  protected acceptChanges(): void {
    this.store.dispatch(CartActions.changesAccepted({ issues: this.review() }));
  }

  protected placeOrder(): void {
    if (this.submitting() || this.blocker() || this.lines().length === 0) return;
    this.store.dispatch(CheckoutActions.submitted({ newKey: crypto.randomUUID() }));
  }

  protected dismissConfirmation(): void {
    this.store.dispatch(CheckoutActions.confirmationDismissed());
  }

  /** What happened to the item, and what accepting the changes will do to the line. */
  protected describe(issue: MenuIssue): string {
    switch (issue.kind) {
      case 'removed':
        return 'No longer on the menu: will be removed.';
      case 'unavailable':
        return 'Not available right now: will be removed.';
      case 'price_changed':
        return `Now ${formatCents(issue.actual)} instead of ${formatCents(issue.expected)}.`;
      case 'pricing_changed':
        return issue.openPrice
          ? 'Its price is now entered when ordering: will be removed, add it again.'
          : 'Now has a fixed price: will be removed, add it again.';
    }
  }
}
