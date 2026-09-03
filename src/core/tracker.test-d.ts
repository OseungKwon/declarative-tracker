import { describe, expectTypeOf, it } from 'vitest';

import type { Adapter } from './adapter';
import { defineEvent, defineEvents } from './define';
import { createTracker } from './tracker';
import type { TrackingEvent } from './types';

const events = defineEvents({
  'banner-click': defineEvent({
    trigger: 'click',
    params: {} as { bannerId: string; position?: number },
    targets: {},
  }),
  'all-optional': defineEvent<{ note?: string }, 'manual'>({ trigger: 'manual', targets: {} }),
  'no-params': { trigger: 'manual', targets: {} },
});

const tracker = createTracker({ events });

describe('tracker.fire', () => {
  it('등록된 키만 받는다', () => {
    tracker.fire('banner-click', { bannerId: 'x' });
    // @ts-expect-error 등록되지 않은 키는 받지 않는다
    tracker.fire('nope');
  });

  it('필수 params가 있으면 params를 요구한다', () => {
    // @ts-expect-error 필수 params가 빠져 있다
    tracker.fire('banner-click');
    // @ts-expect-error 필수 키 bannerId가 빠져 있다
    tracker.fire('banner-click', { position: 1 });
    // @ts-expect-error 선언하지 않은 params 키다
    tracker.fire('banner-click', { bannerId: 'x', extra: 1 });
  });

  it('필수 params가 없으면 params를 생략할 수 있다', () => {
    tracker.fire('all-optional');
    tracker.fire('all-optional', { note: 'n' });
    tracker.fire('no-params');
    tracker.fire('no-params', { anything: 1 });
  });

  it('세 번째 인자로 meta를 받는다', () => {
    tracker.fire('banner-click', { bannerId: 'x' }, { trigger: 'click' });
    tracker.fire('no-params', undefined, { trigger: 'mount', element: document.body });
    // @ts-expect-error 등록되지 않은 트리거 이름이다
    tracker.fire('no-params', undefined, { trigger: 'hover' });
  });
});

describe('Adapter', () => {
  it('payload 타입을 지정한 어댑터를 등록할 수 있다', () => {
    interface Ga4Payload {
      name: string;
    }
    const ga4: Adapter<Ga4Payload> = {
      name: 'ga4',
      send(payload, event) {
        expectTypeOf(payload).toEqualTypeOf<Ga4Payload>();
        expectTypeOf(event).toEqualTypeOf<TrackingEvent>();
      },
    };
    createTracker({ events, adapters: [ga4] });
  });
});
