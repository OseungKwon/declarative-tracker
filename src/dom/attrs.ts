import type { EventKeys, EventMap, EventParams } from '../core/types';
import { DEFAULT_PREFIX } from './resolve';

export type TrackAttrs = Record<string, string>;

/** 요소에 펼칠 data-track 속성을 만든다. params가 있으면 JSON 속성으로 넣는다. */
export function trackAttrs<M extends EventMap, K extends EventKeys<M>>(
  key: K,
  params?: EventParams<M, K>,
  prefix: string = DEFAULT_PREFIX,
): TrackAttrs {
  const attrs: TrackAttrs = { [prefix]: key };
  if (params && Object.keys(params).length > 0) {
    attrs[`${prefix}-params`] = JSON.stringify(params);
  }
  return attrs;
}
