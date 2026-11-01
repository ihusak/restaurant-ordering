import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import type { Category } from '@shared';
import { menuFeature } from '../../state/menu/menu.reducer';
import { SetupActions } from '../../state/menu/setup.actions';
import { trackEditConflict } from './edit-conflict';
import { MenuEditor } from './menu-editor.service';

export interface CategoryDialogData {
  category?: Category;
}

@Component({
  selector: 'app-category-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ category ? 'Rename category' : 'New category' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content>
        @switch (conflict()) {
          @case ('changed') {
            <div class="conflict" role="alert">
              <mat-icon aria-hidden="true">info</mat-icon>
              <span>Someone else renamed this category.</span>
              <button mat-button type="button" (click)="loadLatest()">Load latest</button>
            </div>
          }
          @case ('deleted') {
            <div class="conflict deleted" role="alert">
              <mat-icon aria-hidden="true">warning</mat-icon>
              <span>Someone else deleted this category.</span>
            </div>
          }
        }
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
        <button mat-flat-button type="submit" [disabled]="saving() || conflict() === 'deleted'">{{ saving() ? 'Saving…' : 'Save' }}</button>
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
    .conflict {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
      padding: 8px 8px 8px 12px;
      border-radius: 8px;
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .conflict span {
      flex: 1;
    }
    .conflict.deleted {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
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
  private readonly tracker = trackEditConflict(
    this.category,
    inject(Store).selectSignal(menuFeature.selectCategoryEntities),
    this.saving,
  );
  protected readonly conflict = this.tracker.conflict;

  protected loadLatest(): void {
    const latest = this.tracker.latest();
    if (!latest) return;
    this.form.setValue({ name: latest.name });
    this.tracker.accept(latest);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.saving() || this.conflict() === 'deleted') {
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
