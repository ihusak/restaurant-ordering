import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { debounce, distinctUntilChanged, of, timer } from 'rxjs';
import type { MenuItem } from '@shared';
import { formatCents } from '../../core/money';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { buildMenuRows } from './menu-rows';
import type { MenuRow } from './menu-rows';

/** Every row of the list has this height: the virtual scroll relies on it, and nothing jumps while loading. */
export const ROW_HEIGHT = 64;
const SEARCH_DEBOUNCE_MS = 200;

@Component({
  selector: 'app-menu-page',
  imports: [ScrollingModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './menu-page.html',
  styleUrl: './menu-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MenuPage {
  private readonly store = inject(Store);
  private readonly window = inject(DOCUMENT).defaultView;
  protected readonly rowHeight = ROW_HEIGHT;
  protected readonly skeletonRows = Array.from({ length: 12 }, (_, index) => index);

  /** `?category=` in the URL. */
  readonly category = input<string>();

  protected readonly status = this.store.selectSignal(menuFeature.selectStatus);
  protected readonly error = this.store.selectSignal(menuFeature.selectError);
  protected readonly categories = this.store.selectSignal(menuFeature.selectAllCategories);
  private readonly itemsByCategory = this.store.selectSignal(menuFeature.selectItemsByCategory);

  protected readonly searchText = signal('');
  /** Waits for a pause in typing; clearing the field applies at once. */
  private readonly query = toSignal(
    toObservable(this.searchText).pipe(
      debounce((text) => (text ? timer(SEARCH_DEBOUNCE_MS) : of(null))),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  protected readonly selectedCategoryId = computed(() => {
    const id = this.category();
    return this.categories().some((category) => category.id === id) ? (id ?? null) : null;
  });
  protected readonly rows = computed(() =>
    buildMenuRows(this.categories(), this.itemsByCategory(), { categoryId: this.selectedCategoryId(), query: this.query() }),
  );
  protected readonly itemCount = computed(() => this.rows().filter((row) => row.kind === 'item').length);
  protected readonly isFiltered = computed(() => this.selectedCategoryId() !== null || this.query() !== '');

  constructor() {
    // A new filter starts from the top of the list.
    let first = true;
    effect(() => {
      this.selectedCategoryId();
      this.query();
      if (first) {
        first = false;
        return;
      }
      untracked(() => this.window?.scrollTo({ top: 0 }));
    });
  }

  protected readonly trackRow = (_: number, row: MenuRow): string => row.id;

  protected price(item: MenuItem): string {
    return item.price === null ? 'Set when ordering' : formatCents(item.price);
  }

  protected search(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  protected clearSearch(): void {
    this.searchText.set('');
  }

  protected reload(): void {
    this.store.dispatch(MenuActions.load());
  }
}
