/** Stands in for the browser EventSource, which jsdom does not have. */
export class FakeEventSource {
  static instances: FakeEventSource[] = [];

  static latest(): FakeEventSource {
    const source = FakeEventSource.instances.at(-1);
    if (!source) throw new Error('No EventSource was opened');
    return source;
  }

  readyState = 0;
  closed = false;
  private readonly listeners = new Map<string, ((event: Event) => void)[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.closed = true;
    this.readyState = 2;
  }

  emit(type: string, data: unknown = {}): void {
    this.readyState = 1;
    this.dispatch(new MessageEvent(type, { data: JSON.stringify(data) }));
  }

  /** `retrying`: the browser keeps trying by itself; otherwise it gave up. */
  fail({ retrying }: { retrying: boolean }): void {
    this.readyState = retrying ? 0 : 2;
    this.dispatch(new Event('error'));
  }

  private dispatch(event: Event): void {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }
}
