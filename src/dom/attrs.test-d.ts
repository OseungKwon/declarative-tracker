import { describe, expectTypeOf, it } from 'vitest';

import { defineEvents } from '../core/define';
import { createTrackAttrs, trackAttrs } from './attrs';

const events = defineEvents({
  'banner-click': { trigger: 'click', params: {} as { bannerId: string }, targets: {} },
  'no-params': { trigger: 'mount', targets: {} },
});

type M = typeof events;

describe('trackAttrs', () => {
  it('이벤트 맵을 주면 키와 params를 검사한다', () => {
    expectTypeOf(events).toHaveProperty('banner-click');
    trackAttrs<M, 'banner-click'>('banner-click', { bannerId: 'x' });
    trackAttrs<M, 'no-params'>('no-params');
    // @ts-expect-error 선언하지 않은 params 키다
    trackAttrs<M, 'banner-click'>('banner-click', { nope: 1 });
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    trackAttrs<M, 'nope'>('nope');
  });

  it('맵 없이도 쓸 수 있다', () => {
    trackAttrs('anything', { whatever: true });
  });
});

describe('createTrackAttrs', () => {
  const attrs = createTrackAttrs<M>();

  it('호출할 때 제네릭 없이 키와 params를 검사한다', () => {
    expectTypeOf(attrs('banner-click', { bannerId: 'x' })).toEqualTypeOf<Record<string, string>>();
    attrs('no-params');
    // @ts-expect-error 선언하지 않은 params 키다
    attrs('banner-click', { nope: 1 });
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    attrs('nope');
  });
});
