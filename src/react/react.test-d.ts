import { describe, expectTypeOf, it } from 'vitest';

import { defineEvents } from '../core/define';
import { createTrackingHooks, useFire } from './hooks';

const events = defineEvents({
  'banner-click': { trigger: 'click', params: {} as { id: string }, targets: {} },
  ping: { trigger: 'manual', targets: {} },
});

type M = typeof events;

describe('useFire', () => {
  it('키를 주면 params 타입이 붙은 함수를 돌려준다', () => {
    expectTypeOf(events).toHaveProperty('ping');
    const fireBanner = useFire<M, 'banner-click'>('banner-click');
    expectTypeOf(fireBanner).parameter(0).toEqualTypeOf<{ id: string }>();
    const firePing = useFire<M, 'ping'>('ping');
    expectTypeOf(firePing).toBeCallableWith();
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    useFire<M, 'nope'>('nope');
  });
});

describe('createTrackingHooks', () => {
  const { useFire: useAppFire, useTrackProps: useAppTrackProps } = createTrackingHooks<M>();

  it('호출할 때 제네릭 없이 키와 params를 검사한다', () => {
    const fire = useAppFire();
    fire('banner-click', { id: 'x' });
    // @ts-expect-error 필수 params가 빠져 있다
    fire('banner-click');
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    fire('nope');

    const fireBanner = useAppFire('banner-click');
    expectTypeOf(fireBanner).parameter(0).toEqualTypeOf<{ id: string }>();
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    useAppFire('nope');
  });

  it('useTrackProps도 키와 params를 검사한다', () => {
    useAppTrackProps('banner-click', { id: 'x' });
    useAppTrackProps('ping');
    // @ts-expect-error 선언하지 않은 params 키다
    useAppTrackProps('banner-click', { nope: 1 });
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    useAppTrackProps('nope');
  });
});
