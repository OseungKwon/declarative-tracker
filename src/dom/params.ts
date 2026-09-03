import type { Params } from '../core/types';

export type BoundParams = Params | (() => Params);

const bound = new WeakMap<Element, BoundParams>();

/** 요소에 params를 직렬화 없이 붙인다. 속성으로 읽은 값보다 우선한다. null이면 뗀다. */
export function bindParams(el: Element, params: BoundParams | null): void {
  if (params === null) bound.delete(el);
  else bound.set(el, params);
}

/** 요소에 붙인 params를 읽는다. getter면 지금 호출한다. */
export function boundParams(el: Element): Params | undefined {
  const value = bound.get(el);
  return typeof value === 'function' ? value() : value;
}
