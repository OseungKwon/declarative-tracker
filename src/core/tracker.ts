import type { Adapter } from './adapter';
import { createAdapterRegistry } from './adapter-registry';
import type { ErrorHandler } from './errors';
import { createLogger, type Logger } from './logger';
import type {
  EventKeys,
  EventMap,
  EventParams,
  Params,
  TrackingContext,
  TrackingEvent,
  TriggerName,
} from './types';

export type { ErrorHandler, ErrorInfo, ErrorPhase } from './errors';

export type Middleware = (event: TrackingEvent, next: (event: TrackingEvent) => void) => void;

export interface TrackerOptions<M extends EventMap> {
  events: M;
  adapters?: Adapter[];
  context?: TrackingContext;
  middleware?: Middleware[];
  onError?: ErrorHandler;
  debug?: boolean;
}

export interface FireMeta {
  trigger?: TriggerName;
  element?: Element;
}

type RequiredKeys<T> = {
  [K in keyof T]-?: Record<never, never> extends Pick<T, K> ? never : K;
}[keyof T];

export type FireArgs<P extends Params> = [RequiredKeys<P>] extends [never]
  ? [params?: P, meta?: FireMeta]
  : [params: P, meta?: FireMeta];

export interface Tracker<M extends EventMap = EventMap> {
  readonly events: M;
  readonly logger: Logger;
  fire: <K extends EventKeys<M>>(key: K, ...args: FireArgs<EventParams<M, K>>) => void;
  getContext(): TrackingContext;
  setContext(patch: TrackingContext): void;
  clearContext(): void;
  setAdapterEnabled(name: string, enabled: boolean): void;
  isAdapterEnabled(name: string): boolean;
  flush(): Promise<void>;
  destroy(): void;
}

/** 이벤트 맵과 어댑터로 트래커를 만든다. */
export function createTracker<M extends EventMap>(options: TrackerOptions<M>): Tracker<M> {
  const { events, adapters = [], middleware = [], debug = false } = options;
  const log = createLogger(debug);
  const onError: ErrorHandler =
    options.onError ??
    ((error, info) => {
      log.error(
        `${info.phase} failed${info.adapter ? ` in adapter "${info.adapter}"` : ''}`,
        error,
      );
    });

  const registry = createAdapterRegistry(adapters, onError);
  registry.setup();

  let context: TrackingContext = { ...options.context };
  let destroyed = false;
  const warnedMissingAdapters = new Set<string>();

  /** 타깃 리졸버를 실행해 어댑터로 보낸다. */
  function dispatch(event: TrackingEvent): void {
    const definition = events[event.key];
    if (!definition) return;

    for (const [name, resolver] of Object.entries(definition.targets)) {
      if (!registry.has(name)) {
        if (!warnedMissingAdapters.has(name)) {
          warnedMissingAdapters.add(name);
          log.warn(`no adapter named "${name}" (used by event "${event.key}")`);
        }
        continue;
      }
      if (!registry.isEnabled(name)) continue;

      let payload: unknown;
      try {
        payload = typeof resolver === 'function' ? resolver(event) : resolver;
      } catch (error) {
        onError(error, { phase: 'resolve', adapter: name, event });
        continue;
      }
      if (payload === null || payload === undefined) continue;

      registry.send(name, payload, event);
    }
  }

  const pipeline = middleware.reduceRight<(event: TrackingEvent) => void>(
    (next, layer) => (event) => {
      layer(event, next);
    },
    dispatch,
  );

  /** 이벤트를 만들어 파이프라인에 태운다. */
  function fire(key: string, params?: Params, meta?: FireMeta): void {
    if (destroyed) {
      log.warn(`fire("${key}") ignored: tracker is destroyed`);
      return;
    }
    if (!(key in events)) {
      log.warn(`fire("${key}") ignored: no such event`);
      return;
    }

    const event: TrackingEvent = {
      key,
      trigger: meta?.trigger ?? 'manual',
      params: params ?? {},
      context: { ...context },
      timestamp: Date.now(),
    };
    if (meta?.element) event.element = meta.element;

    pipeline(event);
  }

  return {
    events,
    logger: log,
    fire,
    getContext: () => ({ ...context }),
    setContext(patch) {
      context = { ...context, ...patch };
    },
    clearContext() {
      context = {};
    },
    setAdapterEnabled(name, enabled) {
      if (!registry.setEnabled(name, enabled)) {
        log.warn(`setAdapterEnabled("${name}") ignored: no such adapter`);
      }
    },
    isAdapterEnabled: (name) => registry.isEnabled(name),
    flush: () => registry.flush(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      registry.teardown();
    },
  };
}
