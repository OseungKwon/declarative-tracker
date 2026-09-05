import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../../core/define';
import { createTracker } from '../../core/tracker';
import type { TrackingEvent } from '../../core/types';
import { observe } from '../observe';
import { impressionTrigger } from './impression';

const events = defineEvents({
  hero: { trigger: 'impression', targets: { log: (e) => e.params } },
  card: {
    trigger: 'impression',
    options: { threshold: 0.2, rootMargin: '10px', minVisibleMs: 1000 },
    targets: { log: 1 },
  },
  feed: {
    trigger: 'impression',
    options: { once: false, minVisibleMs: 100 },
    targets: { log: 1 },
  },
});

type Send = (payload: unknown, event: TrackingEvent) => void;
type IOCallback = (entries: IntersectionObserverEntry[]) => void;

class FakeIO {
  observe = vi.fn<(el: Element) => void>();
  unobserve = vi.fn<(el: Element) => void>();
  disconnect = vi.fn<() => void>();

  constructor(
    readonly callback: IOCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    instances.push(this);
  }

  /** 요소가 보이거나 사라진 것으로 콜백을 부른다. 기본은 뷰포트 1000px, 요소 100px */
  see(el: Element, isIntersecting = true, { height = 100, rootHeight = 1000 } = {}) {
    this.callback([
      {
        target: el,
        isIntersecting,
        boundingClientRect: { height } as DOMRectReadOnly,
        rootBounds: { height: rootHeight } as DOMRectReadOnly,
      } as IntersectionObserverEntry,
    ]);
  }
}

const instances: FakeIO[] = [];

let unmount: (() => void) | undefined;
let send: ReturnType<typeof vi.fn<Send>>;

/** body에 HTML을 넣고 impression 트리거로 mount한다. */
function setup(html: string) {
  document.body.innerHTML = html;
  send = vi.fn<Send>();
  unmount = observe(createTracker({ events, adapters: [{ name: 'log', send }] }), {
    triggers: [impressionTrigger()],
  });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  instances.length = 0;
  vi.stubGlobal('IntersectionObserver', FakeIO);
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('impressionTrigger', () => {
  it('기본 threshold 0.5, rootMargin 0px로 관찰한다', () => {
    setup(`<div data-track="hero"></div>`);

    expect(instances).toHaveLength(1);
    expect(instances[0]?.options).toEqual({ threshold: 0.5, rootMargin: '0px' });
    expect(instances[0]?.observe).toHaveBeenCalledWith(document.querySelector('div'));
  });

  it('같은 옵션끼리 observer를 공유하고 다른 옵션은 따로 만든다', () => {
    setup(`
      <div data-track="hero"></div>
      <div data-track="hero"></div>
      <div data-track="card"></div>`);

    expect(instances).toHaveLength(2);
    expect(instances[0]?.observe).toHaveBeenCalledTimes(2);
    expect(instances[1]?.options).toEqual({ threshold: 0.2, rootMargin: '10px' });
  });

  it('보이면 한 번만 발화하고 관찰을 멈춘다', () => {
    setup(`<div data-track="hero" data-track-id="h1"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el);
    instances[0]?.see(el);

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      { id: 'h1' },
      expect.objectContaining({ key: 'hero', trigger: 'impression', element: el }),
    );
    expect(instances[0]?.unobserve).toHaveBeenCalledWith(el);
  });

  it('minVisibleMs 동안 계속 보여야 발화한다', () => {
    vi.useFakeTimers();
    setup(`<div data-track="card"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el);
    vi.advanceTimersByTime(999);
    expect(send).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(send).toHaveBeenCalledOnce();
  });

  it('minVisibleMs 전에 사라지면 발화하지 않는다', () => {
    vi.useFakeTimers();
    setup(`<div data-track="card"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el);
    vi.advanceTimersByTime(500);
    instances[0]?.see(el, false);
    vi.advanceTimersByTime(1000);

    expect(send).not.toHaveBeenCalled();
  });

  it('once가 false면 관찰을 유지하고 다시 보일 때마다 보낸다', () => {
    vi.useFakeTimers();
    setup(`<div data-track="feed"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledOnce();
    expect(instances[0]?.unobserve).not.toHaveBeenCalled();

    instances[0]?.see(el, false);
    instances[0]?.see(el);
    vi.advanceTimersByTime(100);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('요소가 제거되면 타이머를 취소하고 관찰을 멈춘다', async () => {
    vi.useFakeTimers();
    setup(`<div data-track="card"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el);
    el.remove();
    await vi.advanceTimersByTimeAsync(0);
    vi.advanceTimersByTime(1000);

    expect(instances[0]?.unobserve).toHaveBeenCalledWith(el);
    expect(send).not.toHaveBeenCalled();
  });

  it('뷰포트보다 큰 요소는 뷰포트를 threshold만큼 채우는 비율로 다시 관찰한다', () => {
    setup(`<div data-track="hero"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el, false, { height: 2000, rootHeight: 1000 });

    expect(instances[0]?.unobserve).toHaveBeenCalledWith(el);
    expect(instances).toHaveLength(2);
    expect(instances[1]?.options).toEqual({ threshold: 0.25, rootMargin: '0px' });
    expect(instances[1]?.observe).toHaveBeenCalledWith(el);

    instances[1]?.see(el, true, { height: 2000, rootHeight: 1000 });
    expect(send).toHaveBeenCalledOnce();
  });

  it('뷰포트보다 작은 요소는 그대로 관찰한다', () => {
    setup(`<div data-track="hero"></div>`);
    const el = document.querySelector('div');
    if (!el) throw new Error('no el');

    instances[0]?.see(el, false, { height: 800, rootHeight: 1000 });

    expect(instances).toHaveLength(1);
    expect(instances[0]?.unobserve).not.toHaveBeenCalled();
  });

  it('unmount하면 observer를 모두 끊는다', async () => {
    setup(`<div data-track="hero"></div><div data-track="card"></div>`);
    await flush();

    unmount?.();
    unmount = undefined;

    expect(instances[0]?.disconnect).toHaveBeenCalledOnce();
    expect(instances[1]?.disconnect).toHaveBeenCalledOnce();
  });
});
