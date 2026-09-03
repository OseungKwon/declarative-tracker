import type { Logger } from '../core/logger';
import type { Params, TriggerName, TriggerOptions } from '../core/types';

export interface TriggerContext {
  root: Element;
  prefix: string;
  logger: Logger;
  fire: (el: Element, extra?: Params) => boolean;
}

export interface TriggerInstance<T extends TriggerName = TriggerName> {
  attach(el: Element, options: TriggerOptions<T> | undefined): void;
  detach?(el: Element): void;
  destroy(): void;
}

export interface Trigger<T extends TriggerName = TriggerName> {
  name: T;
  setup(ctx: TriggerContext): TriggerInstance<T>;
}

/** 트리거 정의를 만든다. 타입 추론용 identity 함수다. */
export function defineTrigger<T extends TriggerName>(trigger: Trigger<T>): Trigger<T> {
  return trigger;
}
