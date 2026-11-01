import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { MAX_QUANTITY } from '@shared';
import { centsToInput, formatCents, parsePrice } from '../../core/money';
import { CartActions } from '../../state/cart/cart.actions';
import { cartFeature } from '../../state/cart/cart.reducer';
import type { CartLine } from '../../state/cart/cart.reducer';

@Component({
  selector: 'app-cart-panel',
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
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

  protected readonly money = formatCents;
  protected readonly discountInput = centsToInput;

  protected setQuantity(line: CartLine, quantity: number): void {
    this.store.dispatch(CartActions.quantityChanged({ lineId: line.lineId, quantity }));
  }

  protected remove(line: CartLine): void {
    this.store.dispatch(CartActions.lineRemoved({ lineId: line.lineId }));
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
}
