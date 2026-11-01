import { DOCUMENT } from '@angular/common';
import { Injectable, Injector, inject } from '@angular/core';
import type { ErrorHandler } from '@angular/core';
import { Notifier } from './notifier.service';

const QUIET_PERIOD_MS = 10_000;

/**
 * Last line of defence for errors nobody caught (also window errors and
 * unhandled promise rejections, see provideBrowserGlobalErrorListeners).
 * The app keeps running; the user gets one calm message instead of a broken screen.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  // Resolved lazily: the handler is created before most services exist.
  private readonly injector = inject(Injector);
  private readonly window = inject(DOCUMENT).defaultView;
  private lastShownAt = Number.NEGATIVE_INFINITY;

  handleError(error: unknown): void {
    console.error(error);
    const now = Date.now();
    if (now - this.lastShownAt < QUIET_PERIOD_MS) return;
    this.lastShownAt = now;
    try {
      this.injector
        .get(Notifier)
        .show('Something went wrong on this page. If anything looks off, reload it.', 'Reload')
        .subscribe(() => this.window?.location.reload());
    } catch (notifyError) {
      // Showing the message failed too: the console is all that is left.
      console.error(notifyError);
    }
  }
}
