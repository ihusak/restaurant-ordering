import { TestBed } from '@angular/core/testing';
import type { ServerEvent } from '@shared';
import { FakeEventSource } from '../../testing/fake-event-source';
import { menuItem } from '../../testing/fixtures';
import { EVENT_SOURCE_FACTORY, RealtimeService, retryDelay } from './realtime.service';
import type { RealtimeMessage } from './realtime.service';

describe('RealtimeService', () => {
  let service: RealtimeService;
  let messages: RealtimeMessage[];

  const change = (version: number): ServerEvent => ({ type: 'item.upserted', item: menuItem({ rev: version }), version });
  const sinceOf = (source: FakeEventSource): string | null => new URL(source.url, 'http://localhost').searchParams.get('since');

  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    messages = [];
    TestBed.configureTestingModule({
      providers: [{ provide: EVENT_SOURCE_FACTORY, useValue: (url: string) => new FakeEventSource(url) as unknown as EventSource }],
    });
    service = TestBed.inject(RealtimeService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from the given sync point and turns server events into messages', () => {
    service.stream({ epoch: 'run-1', version: 5 }).subscribe((message) => messages.push(message));
    const source = FakeEventSource.latest();
    expect(sinceOf(source)).toBe('run-1:5');

    source.emit('hello', { epoch: 'run-1', version: 6 });
    source.emit('change', change(6));
    source.emit('resync');

    expect(messages).toEqual([
      { kind: 'hello', hello: { epoch: 'run-1', version: 6 } },
      { kind: 'change', event: change(6) },
      { kind: 'resync' },
    ]);
  });

  it('leaves reconnecting to the browser while it is still trying', () => {
    service.stream({ epoch: 'run-1', version: 0 }).subscribe((message) => messages.push(message));
    FakeEventSource.latest().fail({ retrying: true });
    vi.advanceTimersByTime(60_000);

    expect(messages).toEqual([{ kind: 'disconnected' }]);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('opens a new stream after a delay when the browser gives up, continuing from the last event', () => {
    service.stream({ epoch: 'run-1', version: 0 }).subscribe((message) => messages.push(message));
    const first = FakeEventSource.latest();
    first.emit('hello', { epoch: 'run-1', version: 0 });
    first.emit('change', change(1));
    first.emit('change', change(2));
    first.fail({ retrying: false });

    expect(first.closed).toBe(true);
    vi.advanceTimersByTime(500);
    expect(FakeEventSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1_000);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(sinceOf(FakeEventSource.latest())).toBe('run-1:2');
  });

  it('waits longer after each failed attempt and starts over once connected', () => {
    service.stream({ epoch: 'run-1', version: 0 }).subscribe();
    FakeEventSource.latest().fail({ retrying: false });
    vi.advanceTimersByTime(1_200);
    FakeEventSource.latest().fail({ retrying: false });
    vi.advanceTimersByTime(1_200);
    expect(FakeEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1_200);
    expect(FakeEventSource.instances).toHaveLength(3);

    FakeEventSource.latest().emit('hello', { epoch: 'run-1', version: 0 });
    FakeEventSource.latest().fail({ retrying: false });
    vi.advanceTimersByTime(1_200);
    expect(FakeEventSource.instances).toHaveLength(4);
  });

  it('retries at once when the browser comes back online', () => {
    service.stream({ epoch: 'run-1', version: 0 }).subscribe();
    for (let i = 0; i < 5; i++) {
      FakeEventSource.latest().fail({ retrying: false });
      vi.advanceTimersByTime(30_000);
    }
    const opened = FakeEventSource.instances.length;
    FakeEventSource.latest().fail({ retrying: false });
    window.dispatchEvent(new Event('online'));
    expect(FakeEventSource.instances).toHaveLength(opened + 1);
  });

  it('closes the stream on unsubscribe', () => {
    const subscription = service.stream({ epoch: 'run-1', version: 0 }).subscribe();
    subscription.unsubscribe();
    expect(FakeEventSource.latest().closed).toBe(true);
  });

  it('grows the delay up to 30 seconds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect([1, 2, 3, 4, 5, 6, 10].map(retryDelay)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });
});
