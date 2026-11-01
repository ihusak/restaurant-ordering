import { Injectable, Injector, inject } from '@angular/core';
import type { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, from, map, switchMap } from 'rxjs';
import type { Observable } from 'rxjs';

const REPEAT_AFTER_MS = 5_000;

/**
 * Short messages at the bottom of the screen. The same message is not repeated while it is still fresh.
 *
 * The snack bar code is loaded on the first message: messages are rare, and the
 * error handler and effects that use this service are part of the first bundle.
 */
@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly injector = inject(Injector);
  private snackBar: Promise<MatSnackBar> | undefined;
  private last: { message: string; at: number } | null = null;

  /** Emits when the user presses the action button. */
  show(message: string, action = 'OK'): Observable<void> {
    const now = Date.now();
    if (this.last?.message === message && now - this.last.at < REPEAT_AFTER_MS) return EMPTY;
    this.last = { message, at: now };
    return from(this.loadSnackBar()).pipe(
      switchMap((snackBar) => snackBar.open(message, action, { duration: 8_000 }).onAction()),
      map(() => undefined),
    );
  }

  private loadSnackBar(): Promise<MatSnackBar> {
    this.snackBar ??= import('@angular/material/snack-bar').then(({ MatSnackBar }) => this.injector.get(MatSnackBar));
    return this.snackBar;
  }
}
