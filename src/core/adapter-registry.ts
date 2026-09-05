import type { Adapter } from './adapter';
import { type ErrorHandler, guard } from './errors';
import type { TrackingEvent } from './types';

export interface AdapterRegistry {
  has(name: string): boolean;
  isEnabled(name: string): boolean;
  setEnabled(name: string, enabled: boolean): boolean;
  setup(): void;
  send(name: string, payload: NonNullable<unknown>, event: TrackingEvent): void;
  flush(): Promise<void>;
  teardown(): void;
}

interface Record {
  adapter: Adapter;
  enabled: boolean;
}

/** 어댑터를 이름으로 관리하고, 어댑터 호출은 하나씩 에러를 격리해 실행한다. */
export function createAdapterRegistry(adapters: Adapter[], onError: ErrorHandler): AdapterRegistry {
  const records = new Map<string, Record>();
  for (const adapter of adapters) {
    if (records.has(adapter.name)) {
      throw new Error(`[declarative-tracker] duplicate adapter name "${adapter.name}"`);
    }
    records.set(adapter.name, { adapter, enabled: true });
  }

  return {
    has: (name) => records.has(name),
    isEnabled: (name) => records.get(name)?.enabled ?? false,
    setEnabled(name, enabled) {
      const record = records.get(name);
      if (!record) return false;
      record.enabled = enabled;
      return true;
    },
    setup() {
      for (const { adapter } of records.values()) {
        if (adapter.setup) {
          guard(() => adapter.setup?.(), { phase: 'setup', adapter: adapter.name }, onError);
        }
      }
    },
    send(name, payload, event) {
      const record = records.get(name);
      if (!record) return;
      guard(
        () => record.adapter.send(payload, event),
        { phase: 'send', adapter: name, event },
        onError,
      );
    },
    async flush() {
      await Promise.all(
        [...records.values()].map(({ adapter }) =>
          Promise.resolve()
            .then(() => adapter.flush?.())
            .catch((error: unknown) => {
              onError(error, { phase: 'flush', adapter: adapter.name });
            }),
        ),
      );
    },
    teardown() {
      for (const { adapter } of records.values()) {
        guard(() => adapter.teardown?.(), { phase: 'teardown', adapter: adapter.name }, onError);
      }
    },
  };
}
