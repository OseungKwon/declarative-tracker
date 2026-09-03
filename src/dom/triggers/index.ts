import type { Trigger } from '../trigger';
import { clickTrigger } from './click';
import { impressionTrigger } from './impression';
import { mountTrigger } from './mount';
import { scrollDepthTrigger } from './scroll-depth';

/** 내장 트리거 4개를 모두 만든다. mount()의 기본값이다. */
export function defaultTriggers(): Trigger[] {
  return [clickTrigger(), mountTrigger(), impressionTrigger(), scrollDepthTrigger()];
}

export { clickTrigger, impressionTrigger, mountTrigger, scrollDepthTrigger };
