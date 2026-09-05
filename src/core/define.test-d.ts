import { describe, expectTypeOf, it } from 'vitest';

import { defineEvent, defineEvents } from './define';
import type { EventKeys, EventParams, Params, TrackingEvent, TriggerName } from './types';

describe('defineEvent', () => {
  it('params를 추론해 타깃 함수의 event에 붙인다', () => {
    const def = defineEvent({
      trigger: 'click',
      params: {} as { bannerId: string; position?: number },
      targets: {
        ga4: (e) => {
          expectTypeOf(e).toEqualTypeOf<TrackingEvent<{ bannerId: string; position?: number }>>();
          return { id: e.params.bannerId };
        },
        appsflyer: { eventName: 'af_banner_click' },
      },
    });

    expectTypeOf(def.trigger).toEqualTypeOf<'click'>();
  });

  it('params가 없으면 Params로 둔다', () => {
    defineEvent({
      trigger: 'mount',
      targets: {
        ga4: (e) => {
          expectTypeOf(e.params).toEqualTypeOf<Params>();
          return null;
        },
      },
    });
  });

  it('선언하지 않은 params 키는 타깃 함수에서 막힌다', () => {
    defineEvent({
      trigger: 'click',
      params: {} as { id: string },
      targets: {
        ga4: (e) => {
          expectTypeOf(e.params).not.toHaveProperty('nope');
          return null;
        },
      },
    });
  });

  it('필수 옵션이 없는 트리거는 options를 생략할 수 있다', () => {
    defineEvent({ trigger: 'click', targets: {} });
    defineEvent({ trigger: 'impression', targets: {} });
    defineEvent({
      trigger: 'impression',
      options: { threshold: 0.5, minVisibleMs: 1000 },
      targets: {},
    });
  });

  it('scroll-depth는 options가 필수다', () => {
    // @ts-expect-error milestones 없음
    defineEvent({ trigger: 'scroll-depth', targets: {} });
    defineEvent({ trigger: 'scroll-depth', options: { milestones: [0.5, 1] }, targets: {} });
  });

  it('다른 트리거의 옵션은 막힌다', () => {
    // @ts-expect-error milestones는 impression 옵션이 아님
    defineEvent({ trigger: 'impression', options: { milestones: [1] }, targets: {} });
  });

  it('등록되지 않은 트리거는 막힌다', () => {
    // @ts-expect-error hover는 등록되지 않은 트리거
    defineEvent({ trigger: 'hover', targets: {} });
  });
});

describe('defineEvents', () => {
  const events = defineEvents({
    'banner-click': {
      trigger: 'click',
      params: {} as { bannerId: string },
      targets: {
        ga4: (e) => {
          expectTypeOf(e.params).toEqualTypeOf<Params>();
          return e.params.bannerId;
        },
      },
    },
    'hero-impression': defineEvent({
      trigger: 'impression',
      params: {} as { heroId: string },
      targets: { ga4: (e) => e.params.heroId },
    }),
    'page-scroll': {
      trigger: 'scroll-depth',
      options: { milestones: [0.25, 0.5] },
      targets: { ga4: { name: 'scroll' } },
    },
  });

  it('키를 추론한다', () => {
    expectTypeOf<EventKeys<typeof events>>().toEqualTypeOf<
      'banner-click' | 'hero-impression' | 'page-scroll'
    >();
  });

  it('키별 params를 추론한다', () => {
    expectTypeOf<EventParams<typeof events, 'banner-click'>>().toEqualTypeOf<{
      bannerId: string;
    }>();
    expectTypeOf<EventParams<typeof events, 'hero-impression'>>().toEqualTypeOf<{
      heroId: string;
    }>();
    expectTypeOf<EventParams<typeof events, 'page-scroll'>>().toEqualTypeOf<Params>();
  });

  it('defineEvent로 감싼 항목은 타깃 함수 안에서도 params 타입이 붙는다', () => {
    defineEvents({
      typed: defineEvent({
        trigger: 'click',
        params: {} as { id: string },
        targets: {
          ga4: (e) => {
            expectTypeOf(e.params).toEqualTypeOf<{ id: string }>();
            return null;
          },
        },
      }),
    });
  });

  it('trigger 리터럴을 유지한다', () => {
    expectTypeOf(events['banner-click'].trigger).toEqualTypeOf<'click'>();
    expectTypeOf(events['page-scroll'].trigger).toEqualTypeOf<'scroll-depth'>();
  });

  it('잘못된 인라인 항목은 막힌다', () => {
    defineEvents({
      // @ts-expect-error scroll-depth는 options 필수
      broken: { trigger: 'scroll-depth', targets: {} },
    });
  });

  it('스프레드로 합친 맵도 키와 params를 추론한다', () => {
    const more = defineEvents({
      'other-click': { trigger: 'click', params: {} as { x: number }, targets: {} },
    });
    const merged = defineEvents({ ...events, ...more });
    expectTypeOf(merged).toHaveProperty('other-click');
    expectTypeOf<EventKeys<typeof merged>>().toEqualTypeOf<
      'banner-click' | 'hero-impression' | 'page-scroll' | 'other-click'
    >();
    expectTypeOf<EventParams<typeof merged, 'other-click'>>().toEqualTypeOf<{ x: number }>();
  });
});

describe('TriggerName', () => {
  it('내장 트리거 목록이다', () => {
    expectTypeOf<TriggerName>().toEqualTypeOf<
      'click' | 'submit' | 'mount' | 'impression' | 'scroll-depth' | 'manual'
    >();
  });
});
