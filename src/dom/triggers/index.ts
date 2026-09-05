import type { Trigger } from '../trigger';
import { clickTrigger } from './click';
import { impressionTrigger } from './impression';
import { mountTrigger } from './mount';
import { scrollDepthTrigger } from './scroll-depth';
import { submitTrigger } from './submit';

/** 내장 트리거 5개를 모두 만든다. mount()의 기본값이다. */
export function defaultTriggers(): Trigger[] {
  return [
    clickTrigger(),
    submitTrigger(),
    mountTrigger(),
    impressionTrigger(),
    scrollDepthTrigger(),
  ];
}

export { clickTrigger, impressionTrigger, mountTrigger, scrollDepthTrigger, submitTrigger };
