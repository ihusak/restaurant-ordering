import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockActions } from '@ngrx/effects/testing';
import { provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { Subject, of } from 'rxjs';
import { MenuActions } from '../state/menu/menu.actions';
import { menuFeature } from '../state/menu/menu.reducer';
import { menuRefreshFailed } from '../state/notifications.effects';
import { AppErrorHandler } from './app-error-handler';
import { Notifier } from './notifier.service';
import { retryInterceptor } from './retry.interceptor';

describe('retryInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([retryInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const fail = (url: string, status: number): void => {
    backend.expectOne(url).flush({ code: 'UNAVAILABLE', message: 'down' }, { status, statusText: 'Error' });
  };

  it('retries a read after a server failure, with growing delays', () => {
    let result: unknown;
    http.get('/api/menu').subscribe((body) => (result = body));
    fail('/api/menu', 503);
    vi.advanceTimersByTime(499);
    backend.expectNone('/api/menu');
    vi.advanceTimersByTime(1);
    fail('/api/menu', 502);
    vi.advanceTimersByTime(1_000);
    backend.expectOne('/api/menu').flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('gives up after three retries', () => {
    let status: number | undefined;
    http.get('/api/menu').subscribe({ error: (error: { status: number }) => (status = error.status) });
    fail('/api/menu', 503);
    for (const delay of [500, 1_000, 2_000]) {
      vi.advanceTimersByTime(delay);
      fail('/api/menu', 503);
    }
    expect(status).toBe(503);
  });

  it('does not retry an error that will not go away', () => {
    let status: number | undefined;
    http.get('/api/items/nope').subscribe({ error: (error: { status: number }) => (status = error.status) });
    fail('/api/items/nope', 404);
    vi.advanceTimersByTime(10_000);
    expect(status).toBe(404);
  });

  it('never repeats a write', () => {
    let status: number | undefined;
    http.patch('/api/items/pizza', { available: false }).subscribe({ error: (error: { status: number }) => (status = error.status) });
    fail('/api/items/pizza', 503);
    vi.advanceTimersByTime(10_000);
    expect(status).toBe(503);
  });
});

describe('Notifier', () => {
  const open = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    open.mockReset().mockReturnValue({ onAction: () => of(undefined) });
    TestBed.configureTestingModule({ providers: [{ provide: MatSnackBar, useValue: { open } }] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not repeat the same message while it is still on screen', async () => {
    const notifier = TestBed.inject(Notifier);
    notifier.show('Offline').subscribe();
    notifier.show('Offline').subscribe();
    notifier.show('Something else').subscribe();
    await vi.advanceTimersByTimeAsync(6_000);
    notifier.show('Offline').subscribe();
    // The snack bar is loaded on demand, so it opens a moment later.
    await vi.advanceTimersByTimeAsync(0);
    expect(open.mock.calls.map(([message]) => message as string)).toEqual(['Offline', 'Something else', 'Offline']);
  });
});

describe('AppErrorHandler', () => {
  const show = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    show.mockReset().mockReturnValue(of());
    TestBed.configureTestingModule({ providers: [AppErrorHandler, { provide: Notifier, useValue: { show } }] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs every error but shows one message for a burst of them', () => {
    const handler = TestBed.inject(AppErrorHandler);
    handler.handleError(new Error('one'));
    handler.handleError(new Error('two'));
    expect(console.error).toHaveBeenCalledTimes(2);
    expect(show).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(10_000);
    handler.handleError(new Error('three'));
    expect(show).toHaveBeenCalledTimes(2);
  });

  it('survives when the message itself cannot be shown', () => {
    show.mockImplementation(() => {
      throw new Error('no overlay');
    });
    expect(() => {
      TestBed.inject(AppErrorHandler).handleError(new Error('boom'));
    }).not.toThrow();
  });
});

describe('menuRefreshFailed effect', () => {
  let actions$: Subject<Action>;
  const show = vi.fn();

  function run(epoch: string | null): Action[] {
    actions$ = new Subject<Action>();
    show.mockReset().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(() => actions$),
        provideMockStore({ selectors: [{ selector: menuFeature.selectEpoch, value: epoch }] }),
        { provide: Notifier, useValue: { show } },
      ],
    });
    const results: Action[] = [];
    TestBed.runInInjectionContext(menuRefreshFailed).subscribe((action) => results.push(action));
    actions$.next(MenuActions.loadFailed({ error: 'The server is unreachable.' }));
    return results;
  }

  it('offers a retry when a refresh fails while old data is still shown', () => {
    expect(run('run-1')).toEqual([MenuActions.load()]);
    expect(show).toHaveBeenCalledWith('Could not refresh the menu. The server is unreachable.', 'Retry');
  });

  it('stays quiet on a failed first load, which the page shows itself', () => {
    expect(run(null)).toEqual([]);
    expect(show).not.toHaveBeenCalled();
  });
});
