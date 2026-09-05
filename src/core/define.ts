import type {
  EventDefinition,
  EventDefinitionInput,
  EventDefinitions,
  EventMap,
  Params,
  TriggerName,
} from './types';

/** 이벤트 하나를 정의한다. params와 trigger를 추론해 타깃 함수에 타입이 붙은 event를 넘긴다. */
export function defineEvent<P extends Params, T extends TriggerName>(
  definition: EventDefinitionInput<P, T>,
): EventDefinition<P, T> {
  return definition;
}

/** 이벤트 맵을 정의한다. 값에서 키와 params를 추론하거나, 키별 params 타입을 제네릭으로 받아 정의를 검사한다. */
export function defineEvents<M extends EventMap>(events: M): M;
export function defineEvents<PM extends object>(events: EventDefinitions<PM>): EventDefinitions<PM>;
export function defineEvents(events: EventMap): EventMap {
  return events;
}
