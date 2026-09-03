import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../core/define';
import { createTracker } from '../core/tracker';
import { mount } from './mount';
import type { Trigger, TriggerContext, TriggerInstance } from './trigger';

const events = defineEvents({
  'banner-click': { trigger: 'click', targets: { log: (e) => e.params } },
  'hero-view': { trigger: 'impression', options: { threshold: 0.7 }, targets: { log: 1 } },
  'manual-only': { trigger: 'manual', targets: { log: 1 } },
  'page-scroll': { trigger: 'scroll-depth', options: { milestones: [1] }, targets: { log: 1 } },
});

interface FakeTrigger extends Trigger {
  attach: ReturnType<typeof vi.fn<TriggerInstance['attach']>>;
  detach: ReturnType<typeof vi.fn<NonNullable<TriggerInstance['detach']>>>;
  destroy: ReturnType<typeof vi.fn<TriggerInstance['destroy']>>;
  ctx: TriggerContext | undefined;
}

/** attach/detach/destroy 호출을 기록하는 가짜 트리거를 만든다. */
function fakeTrigger(name: Trigger['name']): FakeTrigger {
  const trigger: FakeTrigger = {
    name,
    attach: vi.fn<TriggerInstance['attach']>(),
    detach: vi.fn<NonNullable<TriggerInstance['detach']>>(),
    destroy: vi.fn<TriggerInstance['destroy']>(),
    ctx: undefined,
    setup(ctx) {
      trigger.ctx = ctx;
      return { attach: trigger.attach, detach: trigger.detach, destroy: trigger.destroy };
    },
  };
  return trigger;
}

/** MutationObserver 콜백이 돌 때까지 기다린다. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let unmount: (() => void) | undefined;

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.restoreAllMocks();
});

describe('mount', () => {
  it('triggers를 주지 않으면 내장 트리거 4개를 쓴다', () => {
    document.body.innerHTML = `<button data-track="banner-click"></button>`;
    const send = vi.fn();
    unmount = mount(createTracker({ events, adapters: [{ name: 'log', send }] }));

    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).toHaveBeenCalledOnce();
  });

  it('document가 없으면 아무것도 하지 않는다', () => {
    vi.stubGlobal('document', undefined);
    const tracker = createTracker({ events });
    expect(() => {
      mount(tracker)();
    }).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('처음에 있던 요소를 트리거에 붙이고 options를 넘긴다', () => {
    document.body.innerHTML = `
      <button data-track="banner-click"></button>
      <div data-track="hero-view"></div>`;
    const click = fakeTrigger('click');
    const impression = fakeTrigger('impression');
    unmount = mount(createTracker({ events }), { triggers: [click, impression] });

    expect(click.attach).toHaveBeenCalledWith(document.querySelector('button'), undefined);
    expect(impression.attach).toHaveBeenCalledWith(document.querySelector('div'), {
      threshold: 0.7,
    });
  });

  it('root 자신도 검사한다', () => {
    document.body.innerHTML = `<section data-track="banner-click"></section>`;
    const click = fakeTrigger('click');
    const root = document.querySelector('section');
    if (!root) throw new Error('no root');
    unmount = mount(createTracker({ events }), { root, triggers: [click] });

    expect(click.attach).toHaveBeenCalledWith(root, undefined);
  });

  it('manual 이벤트와 없는 키는 붙이지 않고, 없는 키는 경고한다', () => {
    document.body.innerHTML = `
      <div data-track="manual-only"></div>
      <div data-track="nope"></div>`;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events, debug: true }), { triggers: [click] });

    expect(click.attach).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('"nope"');
  });

  it('등록되지 않은 트리거는 한 번만 경고한다', () => {
    document.body.innerHTML = `
      <div data-track="hero-view"></div>
      <div data-track="hero-view"></div>`;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    unmount = mount(createTracker({ events, debug: true }), { triggers: [] });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('"impression"');
  });

  it('트리거 이름이 겹치면 throw한다', () => {
    expect(() =>
      mount(createTracker({ events }), { triggers: [fakeTrigger('click'), fakeTrigger('click')] }),
    ).toThrow('duplicate trigger name "click"');
  });

  it('나중에 추가된 서브트리의 요소를 붙인다', async () => {
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `<span><button data-track="banner-click"></button></span>`;
    document.body.append(wrapper);
    await flush();

    expect(click.attach).toHaveBeenCalledOnce();
    expect(click.attach).toHaveBeenCalledWith(wrapper.querySelector('button'), undefined);
  });

  it('제거된 요소는 뗀다', async () => {
    document.body.innerHTML = `<div id="w"><button data-track="banner-click"></button></div>`;
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });
    const button = document.querySelector('button');

    document.getElementById('w')?.remove();
    await flush();

    expect(click.detach).toHaveBeenCalledWith(button);
  });

  it('이동한 요소는 떼지도 다시 붙이지도 않는다', async () => {
    document.body.innerHTML = `
      <div id="a"><button data-track="banner-click"></button></div>
      <div id="b"></div>`;
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });
    const button = document.querySelector('button');
    if (!button) throw new Error('no button');

    document.getElementById('b')?.append(button);
    await flush();

    expect(click.attach).toHaveBeenCalledOnce();
    expect(click.detach).not.toHaveBeenCalled();
  });

  it('data-track 값이 바뀌면 떼고 다시 붙인다', async () => {
    document.body.innerHTML = `<div data-track="banner-click"></div>`;
    const click = fakeTrigger('click');
    const impression = fakeTrigger('impression');
    unmount = mount(createTracker({ events }), { triggers: [click, impression] });
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    el.setAttribute('data-track', 'hero-view');
    await flush();

    expect(click.detach).toHaveBeenCalledWith(el);
    expect(impression.attach).toHaveBeenCalledWith(el, { threshold: 0.7 });
  });

  it('data-track 값이 같으면 건드리지 않는다', async () => {
    document.body.innerHTML = `<div data-track="banner-click"></div>`;
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });

    document.querySelector('div')?.setAttribute('data-track', 'banner-click');
    await flush();

    expect(click.attach).toHaveBeenCalledOnce();
    expect(click.detach).not.toHaveBeenCalled();
  });

  it('data-track 속성이 사라지면 뗀다', async () => {
    document.body.innerHTML = `<div data-track="banner-click"></div>`;
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });
    const el = document.querySelector('div');

    el?.removeAttribute('data-track');
    await flush();

    expect(click.detach).toHaveBeenCalledWith(el);
  });

  it('prefix를 바꿀 수 있다', () => {
    document.body.innerHTML = `
      <div data-analytics="banner-click"></div>
      <div data-track="banner-click"></div>`;
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { prefix: 'data-analytics', triggers: [click] });

    expect(click.attach).toHaveBeenCalledOnce();
    expect(click.attach).toHaveBeenCalledWith(
      document.querySelector('[data-analytics]'),
      undefined,
    );
  });

  it('unmount하면 트리거를 destroy하고 감시를 멈춘다', async () => {
    const click = fakeTrigger('click');
    unmount = mount(createTracker({ events }), { triggers: [click] });

    unmount();
    unmount();
    document.body.innerHTML = `<button data-track="banner-click"></button>`;
    await flush();

    expect(click.destroy).toHaveBeenCalledOnce();
    expect(click.attach).not.toHaveBeenCalled();
  });

  describe('ctx.fire', () => {
    it('발화 시점의 params를 읽어 trigger와 element를 붙여 보낸다', () => {
      document.body.innerHTML = `
        <main data-track-ctx-page="home">
          <button data-track="banner-click" data-track-id="1"></button>
        </main>`;
      const send = vi.fn();
      const tracker = createTracker({ events, adapters: [{ name: 'log', send }] });
      const click = fakeTrigger('click');
      unmount = mount(tracker, { triggers: [click] });
      const button = document.querySelector('button');
      if (!button) throw new Error('no button');

      button.setAttribute('data-track-id', '2');
      expect(click.ctx?.fire(button, { extra: true })).toBe(true);

      expect(send).toHaveBeenCalledWith(
        { page: 'home', id: '2', extra: true },
        expect.objectContaining({ key: 'banner-click', trigger: 'click', element: button }),
      );
    });

    it('키의 트리거가 다르거나 키가 없으면 보내지 않는다', () => {
      document.body.innerHTML = `
        <div data-track="hero-view"></div>
        <div data-track="nope"></div>
        <div></div>`;
      const send = vi.fn();
      const tracker = createTracker({ events, adapters: [{ name: 'log', send }] });
      const click = fakeTrigger('click');
      unmount = mount(tracker, { triggers: [click, fakeTrigger('impression')] });
      const [hero, nope, plain] = document.querySelectorAll('div');

      expect(click.ctx?.fire(hero as Element)).toBe(false);
      expect(click.ctx?.fire(nope as Element)).toBe(false);
      expect(click.ctx?.fire(plain as Element)).toBe(false);
      expect(send).not.toHaveBeenCalled();
    });

    it('root, prefix, logger를 트리거에 넘긴다', () => {
      const tracker = createTracker({ events });
      const click = fakeTrigger('click');
      unmount = mount(tracker, { triggers: [click] });

      expect(click.ctx?.root).toBe(document.body);
      expect(click.ctx?.prefix).toBe('data-track');
      expect(click.ctx?.logger).toBe(tracker.logger);
    });
  });
});
