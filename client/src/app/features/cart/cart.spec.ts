import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Store, provideState, provideStore } from '@ngrx/store';
import { menuItem } from '../../../testing/fixtures';
import { CartActions } from '../../state/cart/cart.actions';
import { cartFeature } from '../../state/cart/cart.reducer';
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

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [CartPanel], providers: [provideStore(), provideState(cartFeature)] });
    store = TestBed.inject(Store) as Store;
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
});
