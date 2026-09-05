import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Adapter } from './adapter';
import { defineEvents } from './define';
import { createTracker } from './tracker';
import type { TrackingEvent } from './types';

interface MockAdapter extends Adapter {
  send: ReturnType<typeof vi.fn<Adapter['send']>>;
}

/** send가 mock인 어댑터를 만든다. */
function mockAdapter(name: string, extra: Partial<Adapter> = {}): MockAdapter {
  return { ...extra, name, send: vi.fn(extra.send) };
}

const events = defineEvents({
  'banner-click': {
    trigger: 'click',
    params: {} as { bannerId: string },
    targets: {
      ga4: (e) => ({ name: 'banner_click', id: e.params.bannerId }),
      console: { static: true },
    },
  },
  'opt-out': {
    trigger: 'manual',
    targets: { ga4: () => null, console: () => undefined },
  },
  'no-targets': { trigger: 'manual', targets: {} },
});

describe('createTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: 1_000 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('fire', () => {
    it('리졸버 결과와 정적 페이로드를 이름이 맞는 어댑터로 보낸다', () => {
      const ga4 = mockAdapter('ga4');
      const consoleAdapter = mockAdapter('console');
      const tracker = createTracker({ events, adapters: [ga4, consoleAdapter] });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(ga4.send).toHaveBeenCalledWith(
        { name: 'banner_click', id: 'b1' },
        expect.objectContaining({ key: 'banner-click', params: { bannerId: 'b1' } }),
      );
      expect(consoleAdapter.send).toHaveBeenCalledWith({ static: true }, expect.anything());
    });

    it('manual 트리거, context 스냅샷, timestamp로 이벤트를 만든다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4], context: { site: 'web' } });

      tracker.fire('banner-click', { bannerId: 'b1' });
      const event = ga4.send.mock.calls[0]?.[1];

      expect(event).toEqual({
        key: 'banner-click',
        trigger: 'manual',
        params: { bannerId: 'b1' },
        context: { site: 'web' },
        timestamp: 1_000,
      });
      expect(event).not.toHaveProperty('element');
    });

    it('meta의 trigger와 element를 이벤트에 넣는다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4] });
      const element = document.createElement('button');

      tracker.fire('banner-click', { bannerId: 'b1' }, { trigger: 'click', element });

      expect(ga4.send.mock.calls[0]?.[1]).toMatchObject({ trigger: 'click', element });
    });

    it('params가 없으면 빈 객체로 둔다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4] });

      tracker.fire('opt-out');
      tracker.fire('no-targets');

      expect(ga4.send).not.toHaveBeenCalled();
    });

    it('리졸버가 null이나 undefined를 돌려주면 그 어댑터는 건너뛴다', () => {
      const ga4 = mockAdapter('ga4');
      const consoleAdapter = mockAdapter('console');
      const tracker = createTracker({ events, adapters: [ga4, consoleAdapter] });

      tracker.fire('opt-out');

      expect(ga4.send).not.toHaveBeenCalled();
      expect(consoleAdapter.send).not.toHaveBeenCalled();
    });

    it('없는 키는 무시하고 debug 모드에서 경고한다', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4], debug: true });

      (tracker as { fire: (key: string) => void }).fire('nope');

      expect(ga4.send).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0]?.[0]).toContain('fire("nope") ignored');
    });

    it('debug가 꺼져 있으면 경고하지 않는다', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const tracker = createTracker({ events });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(warn).not.toHaveBeenCalled();
    });

    it('없는 어댑터는 이름당 한 번만 경고한다', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const tracker = createTracker({ events, debug: true });

      tracker.fire('banner-click', { bannerId: 'b1' });
      tracker.fire('banner-click', { bannerId: 'b2' });

      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.includes('"ga4"'))).toHaveLength(1);
      expect(messages.filter((m) => m.includes('"console"'))).toHaveLength(1);
    });
  });

  describe('logger', () => {
    it('debug일 때만 warn을 출력한다', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      createTracker({ events }).logger.warn('quiet');
      expect(warn).not.toHaveBeenCalled();
      createTracker({ events, debug: true }).logger.warn('loud');
      expect(warn).toHaveBeenCalledOnce();
    });

    it('logger 옵션을 주면 콘솔 대신 그리로 보낸다', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const logger = { warn: vi.fn(), error: vi.fn() };
      const tracker = createTracker({ events, debug: true, logger });

      tracker.logger.warn('w', 1);
      tracker.logger.error('e', 2);

      expect(logger.warn).toHaveBeenCalledWith('w', 1);
      expect(logger.error).toHaveBeenCalledWith('e', 2);
      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('logger를 줘도 debug가 꺼져 있으면 warn은 가지 않는다', () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      createTracker({ events, logger }).logger.warn('quiet');
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('어댑터 에러의 기본 onError는 logger.error로 간다', () => {
      const logger = { warn: vi.fn(), error: vi.fn() };
      const failing = mockAdapter('ga4', {
        send: () => {
          throw new Error('boom');
        },
      });
      createTracker({ events, adapters: [failing], logger }).fire('banner-click', {
        bannerId: '1',
      });
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('send failed'),
        expect.any(Error),
      );
    });

    it('logger: false면 아무것도 찍지 않는다', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const tracker = createTracker({ events, debug: true, logger: false });

      tracker.logger.warn('w');
      tracker.logger.error('e');

      expect(consoleWarn).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('context', () => {
    it('병합하고, 스냅샷을 찍고, 비운다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4], context: { a: 1 } });

      tracker.setContext({ b: 2 });
      expect(tracker.getContext()).toEqual({ a: 1, b: 2 });

      tracker.fire('banner-click', { bannerId: 'b1' });
      tracker.setContext({ c: 3 });
      expect(ga4.send.mock.calls[0]?.[1].context).toEqual({ a: 1, b: 2 });

      tracker.clearContext();
      expect(tracker.getContext()).toEqual({});
    });

    it('getContext 반환값을 바꿔도 내부 context는 그대로다', () => {
      const tracker = createTracker({ events, context: { a: 1 } });
      tracker.getContext().a = 2;
      expect(tracker.getContext()).toEqual({ a: 1 });
    });
  });

  describe('middleware', () => {
    it('순서대로 실행되고 이벤트를 바꿀 수 있다', () => {
      const ga4 = mockAdapter('ga4');
      const order: string[] = [];
      const tracker = createTracker({
        events,
        adapters: [ga4],
        middleware: [
          (event, next) => {
            order.push('first');
            next({ ...event, context: { ...event.context, first: true } });
          },
          (event, next) => {
            order.push('second');
            next(event);
          },
        ],
      });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(order).toEqual(['first', 'second']);
      expect(ga4.send.mock.calls[0]?.[1].context).toEqual({ first: true });
    });

    it('next를 부르지 않으면 이벤트를 버린다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4], middleware: [() => undefined] });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(ga4.send).not.toHaveBeenCalled();
    });
  });

  describe('어댑터 on/off', () => {
    it('꺼진 어댑터는 건너뛰고 다시 켜면 보낸다', () => {
      const ga4 = mockAdapter('ga4');
      const tracker = createTracker({ events, adapters: [ga4] });

      tracker.setAdapterEnabled('ga4', false);
      expect(tracker.isAdapterEnabled('ga4')).toBe(false);
      tracker.fire('banner-click', { bannerId: 'b1' });
      expect(ga4.send).not.toHaveBeenCalled();

      tracker.setAdapterEnabled('ga4', true);
      tracker.fire('banner-click', { bannerId: 'b2' });
      expect(ga4.send).toHaveBeenCalledOnce();
    });

    it('없는 어댑터는 꺼진 것으로 본다', () => {
      const tracker = createTracker({ events });
      expect(tracker.isAdapterEnabled('ga4')).toBe(false);
    });

    it('어댑터 이름이 겹치면 throw한다', () => {
      expect(() =>
        createTracker({ events, adapters: [mockAdapter('ga4'), mockAdapter('ga4')] }),
      ).toThrow('duplicate adapter name "ga4"');
    });
  });

  describe('에러 격리', () => {
    it('send가 throw해도 다른 어댑터에는 계속 보낸다', () => {
      const onError = vi.fn();
      const boom = new Error('boom');
      const ga4 = mockAdapter('ga4', {
        send: () => {
          throw boom;
        },
      });
      const consoleAdapter = mockAdapter('console');
      const tracker = createTracker({ events, adapters: [ga4, consoleAdapter], onError });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(consoleAdapter.send).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(boom, {
        phase: 'send',
        adapter: 'ga4',
        event: expect.objectContaining({ key: 'banner-click' }) as TrackingEvent,
      });
    });

    it('비동기 send의 reject를 onError로 넘긴다', async () => {
      const onError = vi.fn();
      const boom = new Error('async boom');
      const ga4 = mockAdapter('ga4', { send: () => Promise.reject(boom) });
      const tracker = createTracker({ events, adapters: [ga4], onError });

      tracker.fire('banner-click', { bannerId: 'b1' });
      await vi.runAllTimersAsync();

      expect(onError).toHaveBeenCalledWith(boom, expect.objectContaining({ phase: 'send' }));
    });

    it('리졸버가 throw하면 onError로 넘기고 다른 타깃은 계속 처리한다', () => {
      const onError = vi.fn();
      const throwing = defineEvents({
        ev: {
          trigger: 'manual',
          targets: {
            ga4: () => {
              throw new Error('resolve boom');
            },
            console: { ok: true },
          },
        },
      });
      const ga4 = mockAdapter('ga4');
      const consoleAdapter = mockAdapter('console');
      const tracker = createTracker({
        events: throwing,
        adapters: [ga4, consoleAdapter],
        onError,
      });

      tracker.fire('ev');

      expect(ga4.send).not.toHaveBeenCalled();
      expect(consoleAdapter.send).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ phase: 'resolve', adapter: 'ga4' }),
      );
    });

    it('onError가 없으면 console.error로 남긴다', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const ga4 = mockAdapter('ga4', {
        send: () => {
          throw new Error('boom');
        },
      });
      const tracker = createTracker({ events, adapters: [ga4] });

      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(error).toHaveBeenCalledOnce();
      expect(error.mock.calls[0]?.[0]).toContain('send failed in adapter "ga4"');
    });
  });

  describe('생명주기', () => {
    it('생성 시 setup을 호출하고 setup 에러를 onError로 넘긴다', () => {
      const onError = vi.fn();
      const setup = vi.fn();
      const failing = mockAdapter('console', {
        setup: () => {
          throw new Error('setup boom');
        },
      });
      createTracker({ events, adapters: [mockAdapter('ga4', { setup }), failing], onError });

      expect(setup).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ phase: 'setup', adapter: 'console' }),
      );
    });

    it('모든 어댑터를 flush하고 flush 에러를 onError로 넘긴다', async () => {
      const onError = vi.fn();
      const flush = vi.fn().mockResolvedValue(undefined);
      const failing = mockAdapter('console', { flush: () => Promise.reject(new Error('x')) });
      const tracker = createTracker({
        events,
        adapters: [mockAdapter('ga4', { flush }), failing],
        onError,
      });

      await tracker.flush();

      expect(flush).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ phase: 'flush', adapter: 'console' }),
      );
    });

    it('destroy하면 teardown을 호출하고 이후 fire는 무시한다', () => {
      const teardown = vi.fn();
      const ga4 = mockAdapter('ga4', { teardown });
      const tracker = createTracker({ events, adapters: [ga4] });

      tracker.destroy();
      tracker.destroy();
      tracker.fire('banner-click', { bannerId: 'b1' });

      expect(teardown).toHaveBeenCalledOnce();
      expect(ga4.send).not.toHaveBeenCalled();
    });
  });
});

describe('schema', () => {
  const planSchema = {
    '~standard': {
      version: 1 as const,
      vendor: 'test',
      validate: (value: unknown) =>
        typeof (value as { plan?: unknown }).plan === 'string'
          ? { value: value as { plan: string } }
          : { issues: [{ message: 'plan is required', path: ['plan'] }] },
    },
  };
  const asyncSchema = {
    '~standard': {
      version: 1 as const,
      vendor: 'test',
      validate: (value: unknown) => Promise.resolve({ value: value as { plan: string } }),
    },
  };
  const schemaEvents = defineEvents({
    signup: { trigger: 'manual', schema: planSchema, targets: { ga4: () => 1 } },
    slow: { trigger: 'manual', schema: asyncSchema, targets: { ga4: () => 1 } },
  });

  it('debug일 때 params가 schema에 맞지 않으면 경고하고 이벤트는 그대로 보낸다', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const ga4 = mockAdapter('ga4');
    const tracker = createTracker({ events: schemaEvents, adapters: [ga4], debug: true, logger });

    tracker.fire('signup', { plan: 'pro' });
    expect(logger.warn).not.toHaveBeenCalled();

    tracker.fire('signup', {} as { plan: string });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid params for "signup"'),
      [{ message: 'plan is required', path: ['plan'] }],
    );
    expect(ga4.send).toHaveBeenCalledTimes(2);
  });

  it('debug가 꺼져 있으면 schema를 부르지 않는다', () => {
    const validate = vi.spyOn(planSchema['~standard'], 'validate');
    createTracker({ events: schemaEvents, adapters: [mockAdapter('ga4')] }).fire(
      'signup',
      {} as { plan: string },
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it('비동기 schema는 건너뛰고 한 번만 경고한다', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const tracker = createTracker({
      events: schemaEvents,
      adapters: [mockAdapter('ga4')],
      debug: true,
      logger,
    });
    tracker.fire('slow', { plan: 'x' });
    tracker.fire('slow', { plan: 'y' });
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('asynchronously'));
  });
});
