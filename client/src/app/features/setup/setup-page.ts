import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import type { Category, MenuItem } from '@shared';
import { confirm } from '../../core/confirm-dialog';
import { formatCents } from '../../core/money';
import { Notifier } from '../../core/notifier.service';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { SetupActions } from '../../state/menu/setup.actions';
import { CategoryDialog } from './category-dialog';
import type { CategoryDialogData } from './category-dialog';
import { ItemDialog } from './item-dialog';
import type { ItemDialogData } from './item-dialog';
import { MenuEditor } from './menu-editor.service';

const byName = (a: MenuItem, b: MenuItem): number => a.name.localeCompare(b.name);

@Component({
  selector: 'app-setup-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './setup-page.html',
  styleUrl: './setup-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupPage {
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  private readonly editor = inject(MenuEditor);

  /** `?category=` in the URL, so a selected category survives a reload and can be linked to. */
  readonly category = input<string>();

  protected readonly status = this.store.selectSignal(menuFeature.selectStatus);
  protected readonly loadError = this.store.selectSignal(menuFeature.selectError);
  protected readonly categories = this.store.selectSignal(menuFeature.selectAllCategories);
  private readonly itemsByCategory = this.store.selectSignal(menuFeature.selectItemsByCategory);

  protected readonly selected = computed<Category | undefined>(() => {
    const categories = this.categories();
    return categories.find((category) => category.id === this.category()) ?? categories[0];
  });
  protected readonly items = computed<MenuItem[]>(() => {
    const id = this.selected()?.id;
    return id ? [...(this.itemsByCategory().get(id) ?? [])].sort(byName) : [];
  });

  /** Availability the user asked for, until the server answers. */
  private readonly pendingAvailability = signal<ReadonlyMap<string, boolean>>(new Map());

  protected isAvailable(item: MenuItem): boolean {
    return this.pendingAvailability().get(item.id) ?? item.available;
  }

  protected isPending(item: MenuItem): boolean {
    return this.pendingAvailability().has(item.id);
  }

  protected async setAvailable(item: MenuItem, available: boolean): Promise<void> {
    this.pendingAvailability.update((pending) => new Map(pending).set(item.id, available));
    const error = await this.editor.run((requestId) =>
      SetupActions.updateItem({ requestId, id: item.id, patch: { available } }),
    );
    // On success the store already holds the new value; on failure the toggle falls back to it.
    this.pendingAvailability.update((pending) => {
      const next = new Map(pending);
      next.delete(item.id);
      return next;
    });
    this.report(error);
  }

  protected countIn(category: Category): number {
    return this.itemsByCategory().get(category.id)?.length ?? 0;
  }

  protected price(item: MenuItem): string {
    return item.price === null ? 'Open price' : formatCents(item.price);
  }

  protected reload(): void {
    this.store.dispatch(MenuActions.load());
  }

  protected addCategory(): void {
    this.dialog.open<CategoryDialog, CategoryDialogData>(CategoryDialog, { data: {}, width: '420px' });
  }

  protected renameCategory(category: Category): void {
    this.dialog.open<CategoryDialog, CategoryDialogData>(CategoryDialog, { data: { category }, width: '420px' });
  }

  protected async deleteCategory(category: Category): Promise<void> {
    const confirmed = await confirm(this.dialog, {
      title: 'Delete category?',
      message: `"${category.name}" will be removed from the menu.`,
      confirm: 'Delete',
    });
    if (!confirmed) return;
    this.report(await this.editor.run((requestId) => SetupActions.deleteCategory({ requestId, id: category.id })));
  }

  protected addItem(category: Category): void {
    this.openItemDialog({ categoryId: category.id });
  }

  protected editItem(item: MenuItem): void {
    this.openItemDialog({ item, categoryId: item.categoryId });
  }

  protected async deleteItem(item: MenuItem): Promise<void> {
    const confirmed = await confirm(this.dialog, {
      title: 'Delete item?',
      message: `"${item.name}" will be removed from the menu.`,
      confirm: 'Delete',
    });
    if (!confirmed) return;
    this.report(await this.editor.run((requestId) => SetupActions.deleteItem({ requestId, id: item.id })));
  }

  private openItemDialog(data: ItemDialogData): void {
    this.dialog.open<ItemDialog, ItemDialogData>(ItemDialog, { data, width: '520px', autoFocus: 'first-tabbable' });
  }

  private report(error: string | null): void {
    if (error) this.notifier.show(error).subscribe();
  }
}
