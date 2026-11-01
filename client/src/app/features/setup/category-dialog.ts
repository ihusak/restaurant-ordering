import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import type { Category } from '@shared';
import { SetupActions } from '../../state/menu/setup.actions';
import { MenuEditor } from './menu-editor.service';

export interface CategoryDialogData {
  category?: Category;
}

@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ category ? 'Rename category' : 'New category' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        <mat-form-field class="field">
          <mat-label>Name</mat-label>
          <input matInput formControlName="name" maxlength="120" cdkFocusInitial />
          @if (form.controls.name.hasError('required')) {
            <mat-error>Enter a name</mat-error>
          }
        </mat-form-field>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .field {
      width: 100%;
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryDialog {
  private readonly ref = inject<MatDialogRef<CategoryDialog, boolean>>(MatDialogRef);
  private readonly editor = inject(MenuEditor);
  protected readonly category = inject<CategoryDialogData>(MAT_DIALOG_DATA).category;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.category?.name ?? '', [Validators.required, Validators.pattern(/\S/)]],
  });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.getRawValue().name.trim();
    const { category } = this;
    this.saving.set(true);
    this.error.set(null);
    const error = await this.editor.run((requestId) =>
      category
        ? SetupActions.updateCategory({ requestId, id: category.id, patch: { name } })
        : SetupActions.createCategory({ requestId, input: { name } }),
    );
    this.saving.set(false);
    if (error) this.error.set(error);
    else this.ref.close(true);
  }
}
