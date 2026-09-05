import { type Ref, type RefCallback, useCallback, useRef } from 'react';

import type { EventKeys, EventMap, EventParams } from '../core/types';
import { bindParams } from '../dom/params';
import { DEFAULT_PREFIX } from '../dom/resolve';

export type TrackProps = Record<string, string | RefCallback<Element>> & {
  ref: RefCallback<Element>;
};

export interface TrackPropsOptions {
  prefix?: string;
  ref?: Ref<Element> | undefined;
}

/** 요소에 펼칠 data-track 속성과 ref를 만든다. params는 ref로 붙이고, options.ref가 있으면 같이 채운다. */
export function useTrackProps<M extends EventMap, K extends EventKeys<M>>(
  key: K,
  params?: EventParams<M, K>,
  options: TrackPropsOptions = {},
): TrackProps {
  const { prefix = DEFAULT_PREFIX, ref: outer } = options;

  const latest = useRef(params);
  latest.current = params;
  const outerRef = useRef(outer);
  outerRef.current = outer;

  const ref = useCallback<RefCallback<Element>>((el) => {
    if (el) bindParams(el, () => latest.current ?? {});
    const target = outerRef.current;
    if (typeof target === 'function') target(el);
    else if (target) target.current = el;
  }, []);

  return { [prefix]: key, ref };
}
