import { type RefCallback, useCallback, useRef } from 'react';

import type { EventKeys, EventMap, EventParams } from '../core/types';
import { bindParams } from '../dom/params';
import { DEFAULT_PREFIX } from '../dom/resolve';

export type TrackProps = Record<string, string | RefCallback<Element>> & {
  ref: RefCallback<Element>;
};

/** 요소에 펼칠 data-track 속성과 ref를 만든다. params는 직렬화 없이 ref로 붙이고 항상 최신 값을 읽는다. */
export function useTrackProps<M extends EventMap, K extends EventKeys<M>>(
  key: K,
  params?: EventParams<M, K>,
  prefix: string = DEFAULT_PREFIX,
): TrackProps {
  const latest = useRef(params);
  latest.current = params;

  const ref = useCallback<RefCallback<Element>>((el) => {
    if (el) bindParams(el, () => latest.current ?? {});
  }, []);

  return { [prefix]: key, ref };
}
