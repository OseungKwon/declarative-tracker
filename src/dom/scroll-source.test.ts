import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scrollDepthOf, subscribeScrollDepth } from './scroll-source';

/** 스크롤 요소를 만들어 높이·위치를 흉내 낸다. */
function makeScroller(scrollTop = 0, scrollHeight = 2000, clientHeight = 1000) {
  const el = document.createElement('div');
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop, writable: true });
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => {
      cb(0);
    }, 16),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    clearTimeout(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('scrollDepthOf', () => {
  it('요소의 스크롤 비율을 돌려주고 끝에서 2px 이내면 1이다', () => {
    expect(scrollDepthOf(makeScroller(0))).toBe(0);
    expect(scrollDepthOf(makeScroller(500))).toBe(0.5);
    expect(scrollDepthOf(makeScroller(998))).toBe(1);
  });

  it('스크롤할 수 없으면 1이다', () => {
    expect(scrollDepthOf(makeScroller(0, 800, 1000))).toBe(1);
  });
});

describe('subscribeScrollDepth', () => {
  it('구독 직후 한 번 알리고, 스크롤마다 프레임당 한 번만 계산한다', () => {
    const el = makeScroller();
    const listener = vi.fn();
    const unsubscribe = subscribeScrollDepth(el, listener);

    vi.advanceTimersByTime(16);
    expect(listener).toHaveBeenCalledWith(0);

    el.scrollTop = 500;
    el.dispatchEvent(new Event('scroll'));
    el.dispatchEvent(new Event('scroll'));
    vi.advanceTimersByTime(16);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenLastCalledWith(0.5);

    unsubscribe();
  });

  it('같은 대상은 리스너 한 쌍을 공유하고 마지막 구독이 끝나면 뗀다', () => {
    const el = makeScroller();
    const add = vi.spyOn(el, 'addEventListener');
    const remove = vi.spyOn(el, 'removeEventListener');

    const a = subscribeScrollDepth(el, vi.fn());
    const b = subscribeScrollDepth(el, vi.fn());
    expect(add).toHaveBeenCalledTimes(1);

    a();
    expect(remove).not.toHaveBeenCalled();
    b();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('window에는 resize도 붙인다', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const unsubscribe = subscribeScrollDepth(window, vi.fn());

    expect(add.mock.calls.map(([type]) => type)).toEqual(['scroll', 'resize']);
    unsubscribe();
  });
});
