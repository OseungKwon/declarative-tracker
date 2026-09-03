import type { TargetPayload, TrackingEvent } from './types';

export interface Adapter<Payload extends TargetPayload = TargetPayload> {
  name: string;
  setup?(): void | Promise<void>;
  send(payload: NonNullable<Payload>, event: TrackingEvent): void | Promise<void>;
  flush?(): void | Promise<void>;
  teardown?(): void;
}
