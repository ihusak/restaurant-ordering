import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import { EMPTY } from 'rxjs';
import { App } from './app';
import { routes } from './app.routes';
import { PageTitleStrategy } from './core/page-title.strategy';
import { initialMenuState } from './state/menu/menu.reducer';
import { initialOrdersState } from './state/orders/orders.reducer';
import { initialConnectionState } from './state/realtime/connection.reducer';

describe('App shell', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: TitleStrategy, useClass: PageTitleStrategy },
        provideMockActions(() => EMPTY),
        provideMockStore({ initialState: { menu: initialMenuState, orders: initialOrdersState, connection: initialConnectionState } }),
      ],
    });
  });

  it('links to every page from the header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('nav a')];
    expect(links.map((link) => [link.textContent.trim(), link.getAttribute('href')])).toEqual([
      [expect.stringContaining('Menu'), '/menu'],
      [expect.stringContaining('Setup'), '/setup'],
      [expect.stringContaining('Orders'), '/orders'],
    ]);
  });

  it('opens the menu by default and for unknown URLs', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Menu');
    await harness.navigateByUrl('/no-such-page');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Menu');
  });

  it('lazy loads a page and puts its name in the browser tab', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/orders');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toBe('Orders');
    expect(TestBed.inject(Title).getTitle()).toBe('Orders · Restaurant ordering');
  });

  it('marks the current page link as active', async () => {
    const fixture = TestBed.createComponent(App);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/setup');
    await fixture.whenStable();
    const active = (fixture.nativeElement as HTMLElement).querySelector('nav a[aria-current="page"]');
    expect(active?.textContent).toContain('Setup');
  });
});
