import { delegatedTrigger, type DelegatedTriggerOptions } from './delegate';

export type ClickTriggerOptions = DelegatedTriggerOptions;

/** 클릭된 곳에서 가장 가까운 data-track 요소를 트리거한다. 기본은 캡처 단계다. */
export function clickTrigger(options: ClickTriggerOptions = {}) {
  return delegatedTrigger('click', 'click', options);
}
