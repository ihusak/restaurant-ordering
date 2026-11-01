import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AbstractControl, ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MAX_FIXED_PRICE } from '@shared';
import type { Category, MenuItem, MenuItemInput } from '@shared';
import { centsToInput, formatCents, parsePrice } from '../../core/money';
import { SetupActions } from '../../state/menu/setup.actions';
import { MenuEditor } from './menu-editor.service';

export interface ItemDialogData {
  item?: MenuItem;
  categoryId: string;
  categories: readonly Category[];
}

function priceValidator(control: AbstractControl<string>): ValidationErrors | null {
  if (control.disabled || control.value.trim() === '') return null;
  const cents = parsePrice(control.value);
  if (cents === null) return { format: true };
  if (cents <= 0) return { min: true };
  if (cents > MAX_FIXED_PRICE) return { max: true };
  return null;
}

@Component({
  selector: 'app-item-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDialog {
  private readonly ref = inject<MatDialogRef<ItemDialog, boolean>>(MatDialogRef);
  private readonly editor = inject(MenuEditor);
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  protected readonly maxPrice = formatCents(MAX_FIXED_PRICE);

  private readonly item = this.data.item;
  protected readonly form = inject(NonNullableFormBuilder).group({
    categoryId: [this.item?.categoryId ?? this.data.categoryId, Validators.required],
    name: [this.item?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
    description: [this.item?.description ?? ''],
    openPrice: [this.item?.openPrice ?? false],
    price: [centsToInput(this.item?.price ?? null), [Validators.required, priceValidator]],
    available: [this.item?.available ?? true],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    // An open-price item has no fixed price: it is entered when the item is ordered.
    const { openPrice, price } = this.form.controls;
    const syncPrice = (open: boolean): void => {
      if (open) price.disable();
      else price.enable();
    };
    syncPrice(openPrice.value);
    openPrice.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(syncPrice);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: MenuItemInput = {
      categoryId: value.categoryId,
      name: value.name.trim(),
      description: value.description.trim(),
      openPrice: value.openPrice,
      price: value.openPrice ? null : parsePrice(value.price),
      available: value.available,
    };
    const { item } = this;
    this.saving.set(true);
    this.error.set(null);
    const error = await this.editor.run((requestId) =>
      item
        ? SetupActions.updateItem({ requestId, id: item.id, patch: input })
        : SetupActions.createItem({ requestId, input }),
    );
    this.saving.set(false);
    if (error) this.error.set(error);
    else this.ref.close(true);
  }
}
