import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { Store, provideState, provideStore } from '@ngrx/store';
import { category, menuItem, menuSnapshot } from '../../../testing/fixtures';
import { of } from 'rxjs';
import { cartFeature } from '../../state/cart/cart.reducer';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { RealtimeActions } from '../../state/realtime/realtime.actions';
import { MenuPage } from './menu-page';

describe('MenuPage', () => {
  let fixture: ComponentFixture<MenuPage>;
  let store: Store;
  const openDialog = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // jsdom has no layout: pretend the window is 1000px tall.
    vi.spyOn(CdkVirtualScrollViewport.prototype, 'getViewportSize').mockReturnValue(1_000);
    TestBed.configureTestingModule({
      imports: [MenuPage],
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(menuFeature),
        provideState(cartFeature),
        { provide: MatDialog, useValue: { open: openDialog } },
      ],
    });
    store = TestBed.inject(Store) as Store;
    fixture = TestBed.createComponent(MenuPage);
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texts = (selector: string): string[] =>
    [...element().querySelectorAll(selector)].map((node) => node.textContent.trim().replace(/\s+/g, ' '));
  const load = async (): Promise<void> => {
    store.dispatch(
      MenuActions.loadSucceeded({
        snapshot: menuSnapshot({
          version: 1,
          categories: [category({ id: 'pizza', name: 'Pizza', sortOrder: 1 }), category({ id: 'drinks', name: 'Drinks', sortOrder: 2 })],
          items: [
            menuItem({ id: 'margherita', categoryId: 'pizza', name: 'Margherita', price: 1250 }),
            menuItem({ id: 'special', categoryId: 'pizza', name: 'Special', openPrice: true, price: null }),
            menuItem({ id: 'cola', categoryId: 'drinks', name: 'Cola', price: 300, available: false }),
          ],
        }),
      }),
    );
    await fixture.whenStable();
  };
  const search = async (text: string): Promise<void> => {
    const input = element().querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('No search field');
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };

  it('shows placeholders of the final row height while the menu loads', () => {
    const skeleton = element().querySelectorAll<HTMLElement>('.skeleton');
    expect(skeleton.length).toBeGreaterThan(0);
    expect(skeleton[0]?.style.height).toBe('64px');
  });

  it('lists categories with their items, prices and availability', async () => {
    await load();
    expect(texts('.heading-name')).toEqual(['Pizza', 'Drinks']);
    expect(texts('.item-name')).toEqual(['Margherita', 'Special', 'Cola Unavailable']);
    expect(texts('.item-price')).toEqual(['$12.50', 'Set when ordering', '$3.00']);
    expect(texts('.summary')).toEqual(['3 items']);
  });

  it('filters by search only after typing pauses', async () => {
    await load();
    await search('cola');
    expect(texts('.item-name')).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(250);
    await fixture.whenStable();
    expect(texts('.item-name')).toEqual(['Cola Unavailable']);
    expect(texts('.summary')).toEqual(['1 item found']);
  });

  it('says so when nothing matches', async () => {
    await load();
    await search('sushi');
    await vi.advanceTimersByTimeAsync(250);
    await fixture.whenStable();
    expect(element().textContent).toContain('Nothing matches your search.');
  });

  it('shows one category when it is selected', async () => {
    await load();
    fixture.componentRef.setInput('category', 'drinks');
    await fixture.whenStable();
    expect(texts('.heading-name')).toEqual(['Drinks']);
    expect(texts('.chip.selected')).toEqual(['Drinks']);
  });

  it('updates a row when the item changes on the server', async () => {
    await load();
    store.dispatch(
      RealtimeActions.eventReceived({
        event: { type: 'item.upserted', item: menuItem({ id: 'margherita', categoryId: 'pizza', name: 'Margherita', price: 1390, rev: 2 }), version: 2 },
      }),
    );
    await fixture.whenStable();
    expect(texts('.item-price')[0]).toBe('$13.90');
  });

  it('renders only the rows near the screen, not the whole menu', async () => {
    const items = Array.from({ length: 3_000 }, (_, index) =>
      menuItem({ id: `item-${index}`, categoryId: 'pizza', name: `Dish ${String(index).padStart(4, '0')}` }),
    );
    store.dispatch(MenuActions.loadSucceeded({ snapshot: menuSnapshot({ categories: [category({ id: 'pizza' })], items }) }));
    await fixture.whenStable();
    const rendered = element().querySelectorAll('.row').length;
    expect(rendered).toBeGreaterThan(10);
    expect(rendered).toBeLessThan(60);
    expect(texts('.summary')).toEqual(['3000 items']);
  });

  describe('adding to the cart', () => {
    const addButton = (name: string): HTMLButtonElement => {
      const row = [...element().querySelectorAll('.row')].find((node) => node.querySelector('.item-name')?.textContent.includes(name));
      const button = row?.querySelector<HTMLButtonElement>('button.add');
      if (!button) throw new Error(`No add button for ${name}`);
      return button;
    };
    const cartBar = (): string | undefined => element().querySelector('.cart-bar')?.textContent.trim().replace(/\s+/g, ' ');

    it('adds an item at the price shown and counts it on the button', async () => {
      await load();
      addButton('Margherita').click();
      addButton('Margherita').click();
      await fixture.whenStable();
      expect(addButton('Margherita').textContent).toContain('2');
      expect(cartBar()).toContain('View cart · 2 items · $25.00');
    });

    it('asks for the price of an open-price item', async () => {
      openDialog.mockReturnValue({ afterClosed: () => of(850) });
      await load();
      addButton('Special').click();
      await fixture.whenStable();
      expect(openDialog).toHaveBeenCalled();
      expect(cartBar()).toContain('1 item · $8.50');
    });

    it('adds nothing when the price dialog is cancelled', async () => {
      openDialog.mockReturnValue({ afterClosed: () => of(undefined) });
      await load();
      addButton('Special').click();
      await fixture.whenStable();
      expect(cartBar()).toBeUndefined();
    });

    it('does not let an unavailable item be added', async () => {
      await load();
      expect(addButton('Cola').disabled).toBe(true);
    });
  });
});
