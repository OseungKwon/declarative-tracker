import { delegatedTrigger, type DelegatedTriggerOptions } from './delegate';

export type SubmitTriggerOptions = DelegatedTriggerOptions;

/** 제출된 폼에서 가장 가까운 data-track 요소를 트리거한다. 기본은 캡처 단계다. */
export function submitTrigger(options: SubmitTriggerOptions = {}) {
  return delegatedTrigger('submit', 'submit', options);
}
