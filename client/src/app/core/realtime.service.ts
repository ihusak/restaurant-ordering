import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { EMPTY, Observable, defer, fromEvent, race, retry, tap, timer } from 'rxjs';
import { SSE_EVENT, formatEventId } from '@shared';
import type { HelloEvent, ServerEvent } from '@shared';

export type RealtimeMessage =
  | { kind: 'hello'; hello: HelloEvent }
  | { kind: 'change'; event: ServerEvent }
  | { kind: 'resync' }
  | { kind: 'disconnected' };

export interface SyncPoint {
  epoch: string;
  version: number;
}

export const EVENT_SOURCE_FACTORY = new InjectionToken<(url: string) => EventSource>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url) => new EventSource(url),
});

const MAX_RETRY_DELAY_MS = 30_000;
/** EventSource.CLOSED, spelled out because EventSource does not exist outside browsers. */
const CLOSED = 2;

/** 1s, 2s, 4s… up to 30s, with jitter so that clients do not reconnect all at once. */
export function retryDelay(attempt: number): number {
  const base = Math.min(1_000 * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
  return Math.round(base * (0.8 + Math.random() * 0.4));
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly createEventSource = inject(EVENT_SOURCE_FACTORY);
  private readonly window = inject(DOCUMENT).defaultView;

  /**
   * Server events that happened after `start`, for as long as it is subscribed.
   *
   * EventSource reconnects by itself after a network error, but gives up when
   * the server answers with an error status (e.g. the dev proxy returns 502
   * while the server is down). Then a new one is opened with a growing delay,
   * continuing from the last event received.
   */
  stream(start: SyncPoint): Observable<RealtimeMessage> {
    let epoch = start.epoch;
    let since = formatEventId(epoch, start.version);
    let attempt = 0;
    return defer(() => this.open(since)).pipe(
      tap((message) => {
        if (message.kind === 'hello') {
          attempt = 0;
          epoch = message.hello.epoch;
        } else if (message.kind === 'change') {
          since = formatEventId(epoch, message.event.version);
        }
      }),
      retry({
        delay: () => {
          attempt++;
          const online$ = this.window ? fromEvent(this.window, 'online') : EMPTY;
          return race(timer(retryDelay(attempt)), online$);
        },
      }),
    );
  }

  private open(since: string): Observable<RealtimeMessage> {
    return new Observable<RealtimeMessage>((subscriber) => {
      const source = this.createEventSource(`/api/events?since=${encodeURIComponent(since)}`);
      source.addEventListener(SSE_EVENT.hello, (event) => {
        subscriber.next({ kind: 'hello', hello: dataOf(event) as HelloEvent });
      });
      source.addEventListener(SSE_EVENT.change, (event) => {
        subscriber.next({ kind: 'change', event: dataOf(event) as ServerEvent });
      });
      source.addEventListener(SSE_EVENT.resync, () => {
        subscriber.next({ kind: 'resync' });
      });
      source.addEventListener('error', () => {
        subscriber.next({ kind: 'disconnected' });
        if (source.readyState === CLOSED) subscriber.error(new Error('The event stream was closed'));
      });
      return () => {
        source.close();
      };
    });
  }
}

function dataOf(event: Event): unknown {
  return JSON.parse((event as MessageEvent<string>).data);
}
