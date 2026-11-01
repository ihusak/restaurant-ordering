import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MAX_OPEN_PRICE } from '@shared';
import type { Cents, MenuItem } from '@shared';
import { formatCents, parsePrice } from '../../core/money';

function openPriceValidator(control: AbstractControl<string>): ValidationErrors | null {
  if (control.value.trim() === '') return null;
  const cents = parsePrice(control.value);
  if (cents === null) return { format: true };
  if (cents <= 0) return { min: true };
  if (cents > MAX_OPEN_PRICE) return { max: true };
  return null;
}

/** Asks for the price of an open-price item; closes with the price in cents. */
@Component({
  selector: 'app-open-price-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ item.name }}</h2>
    <form [formGroup]="form" (ngSubmit)="add()">
      <mat-dialog-content>
        <p class="hint">This item has no fixed price. Enter the price for this order.</p>
        <mat-form-field class="field">
          <mat-label>Price</mat-label>
          <span matTextPrefix>$&nbsp;</span>
          <input matInput formControlName="price" inputmode="decimal" autocomplete="off" cdkFocusInitial />
          @let price = form.controls.price;
          @if (price.hasError('required')) {
            <mat-error>Enter a price</mat-error>
          } @else if (price.hasError('format')) {
            <mat-error>Use a number like 12.50</mat-error>
          } @else if (price.hasError('min')) {
            <mat-error>The price must be more than zero</mat-error>
          } @else if (price.hasError('max')) {
            <mat-error>The price cannot be more than {{ maxPrice }}</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit">Add to cart</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .hint {
      margin-top: 0;
      color: var(--mat-sys-on-surface-variant);
    }
    .field {
      width: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpenPriceDialog {
  private readonly ref = inject<MatDialogRef<OpenPriceDialog, Cents>>(MatDialogRef);
  protected readonly item = inject<MenuItem>(MAT_DIALOG_DATA);
  protected readonly maxPrice = formatCents(MAX_OPEN_PRICE);
  protected readonly form = inject(NonNullableFormBuilder).group({
    price: ['', [Validators.required, openPriceValidator]],
  });

  protected add(): void {
    const price = parsePrice(this.form.getRawValue().price);
    if (this.form.invalid || price === null) {
      this.form.markAllAsTouched();
      return;
    }
    this.ref.close(price);
  }
}
