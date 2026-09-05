export type Params = Record<string, unknown>;

export type TrackingContext = Record<string, unknown>;

export type NoOptions = Record<never, never>;

export interface TriggerRegistry {
  click: NoOptions;
  mount: NoOptions;
  impression: ImpressionOptions;
  'scroll-depth': ScrollDepthOptions;
  manual: NoOptions;
}

export type TriggerName = keyof TriggerRegistry;

export type TriggerOptions<T extends TriggerName> = TriggerRegistry[T];

export interface ImpressionOptions {
  threshold?: number;
  minVisibleMs?: number;
  rootMargin?: string;
  once?: boolean;
}

export interface ScrollDepthOptions {
  milestones: number[];
  container?: string;
}

export interface TrackingEvent<P extends Params = Params> {
  key: string;
  trigger: TriggerName;
  params: P;
  context: TrackingContext;
  timestamp: number;
  element?: Element;
}

export type TargetPayload = string | number | boolean | null | undefined | object;

export type TargetResolverFn<
  P extends Params = Params,
  Payload extends TargetPayload = TargetPayload,
> = {
  bivarianceHack(event: TrackingEvent<P>): Payload;
}['bivarianceHack'];

export type TargetResolver<
  P extends Params = Params,
  Payload extends TargetPayload = TargetPayload,
> = Payload | TargetResolverFn<P, Payload>;

export type TargetMap<P extends Params = Params> = Record<string, TargetResolver<P>>;

interface EventDefinitionBase<P extends Params> {
  params?: P;
  targets: TargetMap<P>;
}

type OptionsField<T extends TriggerName> =
  NoOptions extends TriggerOptions<T>
    ? { options?: TriggerOptions<T> }
    : { options: TriggerOptions<T> };

export type EventDefinitionInput<
  P extends Params,
  T extends TriggerName,
> = EventDefinitionBase<P> & {
  trigger: T;
} & OptionsField<T>;

export type EventDefinition<P extends Params = Params, T extends TriggerName = TriggerName> = {
  [K in T]: EventDefinitionInput<P, K>;
}[T];

export type EventMap = Record<string, EventDefinition>;

export type InferParams<D> = D extends { params?: infer P extends Params } ? P : Params;

export type EventKeys<M extends EventMap> = Extract<keyof M, string>;

export type EventParams<M extends EventMap, K extends EventKeys<M>> = InferParams<M[K]>;
