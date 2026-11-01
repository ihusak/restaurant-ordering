import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { ActionsSubject, Store, provideState, provideStore } from '@ngrx/store';
import type { Action } from '@ngrx/store';
import { menuItem, menuSnapshot, order } from '../../../testing/fixtures';
import { CartActions } from '../../state/cart/cart.actions';
import { cartFeature } from '../../state/cart/cart.reducer';
import { CheckoutActions } from '../../state/checkout/checkout.actions';
import { checkoutFeature } from '../../state/checkout/checkout.reducer';
import { MenuActions } from '../../state/menu/menu.actions';
import { menuFeature } from '../../state/menu/menu.reducer';
import { connectionFeature } from '../../state/realtime/connection.reducer';
import { RealtimeActions } from '../../state/realtime/realtime.actions';
import { CartPanel } from './cart-panel';
import { OpenPriceDialog } from './open-price-dialog';

const textOf = (fixture: ComponentFixture<unknown>): string =>
  (fixture.nativeElement as HTMLElement).textContent.replace(/\s+/g, ' ');

describe('OpenPriceDialog', () => {
  let fixture: ComponentFixture<OpenPriceDialog>;
  const close = vi.fn();

  beforeEach(async () => {
    close.mockReset();
    TestBed.configureTestingModule({
      imports: [OpenPriceDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: menuItem({ name: 'Catch of the day', openPrice: true, price: null }) },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(OpenPriceDialog);
    await fixture.whenStable();
  });

  const enter = async (value: string): Promise<void> => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input');
    if (!input) throw new Error('No price field');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };

  it('closes with the entered price in cents', async () => {
    await enter('18.9');
    expect(close).toHaveBeenCalledWith(1890);
  });

  it.each([
    ['', 'Enter a price'],
    ['0', 'more than zero'],
    ['1000.01', 'cannot be more than $1,000.00'],
    ['ten', 'Use a number like 12.50'],
  ])('refuses "%s"', async (value, message) => {
    await enter(value);
    expect(close).not.toHaveBeenCalled();
    expect(textOf(fixture)).toContain(message);
  });
});

describe('CartPanel', () => {
  let fixture: ComponentFixture<CartPanel>;
  let store: Store;
  let dispatched: Action[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CartPanel],
      providers: [
        provideRouter([]),
        provideStore(),
        provideState(cartFeature),
        provideState(menuFeature),
        provideState(checkoutFeature),
        provideState(connectionFeature),
      ],
    });
    store = TestBed.inject(Store) as Store;
    dispatched = [];
    TestBed.inject(ActionsSubject).subscribe((action) => dispatched.push(action));
    store.dispatch(CartActions.itemAdded({ item: menuItem({ id: 'pizza', name: 'Pizza', price: 1250 }), unitPrice: 1250 }));
    fixture = TestBed.createComponent(CartPanel);
    await fixture.whenStable();
  });

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const click = async (label: string): Promise<void> => {
    element().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)?.click();
    await fixture.whenStable();
  };
  const setDiscount = async (value: string): Promise<void> => {
    const input = element().querySelector<HTMLInputElement>('.discount input');
    if (!input) throw new Error('No discount field');
    input.value = value;
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  };

  it('changes the quantity and shows the totals', async () => {
    await click('One more Pizza');
    expect(element().querySelector('.quantity')?.textContent).toBe('2');
    expect(element().querySelector('.total dd')?.textContent).toBe('$25.00');
  });

  it('applies a discount and warns when it is more than the subtotal', async () => {
    await setDiscount('2.50');
    expect(element().querySelector('.total dd')?.textContent).toBe('$10.00');

    await setDiscount('20');
    expect(textOf(fixture)).toContain('The discount cannot be more than the subtotal');
  });

  it('removes the line when the quantity goes below one', async () => {
    await click('Remove Pizza');
    expect(textOf(fixture)).toContain('Your cart is empty');
  });

  const placeButton = (): HTMLButtonElement | null => element().querySelector('button.place-order');

  it('places the order with a fresh idempotency key', async () => {
    placeButton()?.click();
    await fixture.whenStable();
    expect(dispatched).toContainEqual(CheckoutActions.submitted({ newKey: expect.any(String) as string }));
    expect(placeButton()?.textContent).toContain('Placing order');
    expect(placeButton()?.disabled).toBe(true);
  });

  it('cannot place an order while offline', async () => {
    store.dispatch(RealtimeActions.browserStatusChanged({ online: false }));
    await fixture.whenStable();
    expect(placeButton()?.disabled).toBe(true);
    expect(textOf(fixture)).toContain('You are offline');
  });

  it('confirms the placed order and empties the cart', async () => {
    store.dispatch(CheckoutActions.succeeded({ order: order({ number: 1042, total: 1250 }) }));
    await fixture.whenStable();
    expect(textOf(fixture)).toContain('Order #1042 placed');
    expect(placeButton()).toBeNull();
  });

  describe('when the menu changes', () => {
    const pizza = menuItem({ id: 'pizza', name: 'Pizza', price: 1250, rev: 1 });
    const loadMenu = async (price: number): Promise<void> => {
      store.dispatch(MenuActions.loadSucceeded({ snapshot: menuSnapshot({ items: [{ ...pizza, price }] }) }));
      await fixture.whenStable();
    };

    it('warns on the line and blocks the order until the change is accepted', async () => {
      await loadMenu(1400);
      expect(element().querySelector('.line-issue')?.textContent).toContain('Now $14.00 instead of $12.50.');
      expect(placeButton()?.disabled).toBe(true);

      [...element().querySelectorAll('button')].find((button) => button.textContent.includes('Accept changes'))?.click();
      await fixture.whenStable();
      expect(element().querySelector('.line-issue')).toBeNull();
      expect(placeButton()?.disabled).toBe(false);
      expect(placeButton()?.textContent).toContain('$14.00');
    });

    it('shows changes the server reported before the live menu has them', async () => {
      await loadMenu(1250);
      store.dispatch(
        CheckoutActions.menuChanged({ issues: [{ itemId: 'pizza', kind: 'price_changed', expected: 1250, actual: 1300 }] }),
      );
      await fixture.whenStable();
      expect(element().querySelector('.line-issue')?.textContent).toContain('Now $13.00');
    });
  });
});
