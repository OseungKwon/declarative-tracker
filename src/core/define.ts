import type { EventDefinition, EventDefinitionInput, EventMap, Params, TriggerName } from './types';

/** 이벤트 하나를 정의한다. params와 trigger를 추론해 타깃 함수에 타입이 붙은 event를 넘긴다. */
export function defineEvent<P extends Params, T extends TriggerName>(
  definition: EventDefinitionInput<P, T>,
): EventDefinition<P, T> {
  return definition;
}

/** 이벤트 맵을 정의한다. 키와 키별 params를 추론한다. */
export function defineEvents<M extends EventMap>(events: M): M {
  return events;
}
