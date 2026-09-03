export type { Adapter } from './core/adapter';
export { defineEvent, defineEvents } from './core/define';
export type { Logger } from './core/logger';
export { createTracker } from './core/tracker';
export type {
  ErrorHandler,
  ErrorInfo,
  ErrorPhase,
  FireArgs,
  FireMeta,
  Middleware,
  Tracker,
  TrackerOptions,
} from './core/tracker';
export type {
  EventDefinition,
  EventDefinitionInput,
  EventKeys,
  EventMap,
  EventParams,
  ImpressionOptions,
  InferParams,
  NoOptions,
  Params,
  ScrollDepthOptions,
  TargetMap,
  TargetPayload,
  TargetResolver,
  TargetResolverFn,
  TrackingContext,
  TrackingEvent,
  TriggerName,
  TriggerOptions,
  TriggerRegistry,
} from './core/types';
