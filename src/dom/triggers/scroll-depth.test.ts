import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../../core/define';
import { createTracker } from '../../core/tracker';
import type { TrackingEvent } from '../../core/types';
import { observe } from '../observe';
import { scrollDepthTrigger } from './scroll-depth';

const events = defineEvents({
  page: {
    trigger: 'scroll-depth',
    options: { milestones: [0.25, 0.5, 0.75, 1] },
    targets: { log: (e) => e.params },
  },
  messy: {
    trigger: 'scroll-depth',
    options: { milestones: [1.5, 0.5, -1, 0.5] },
    targets: { log: (e) => e.params },
  },
  empty: { trigger: 'scroll-depth', options: { milestones: [] }, targets: { log: 1 } },
  feed: {
    trigger: 'scroll-depth',
    options: { milestones: [0.5, 1], container: '#feed' },
    targets: { log: (e) => e.params },
  },
  missing: {
    trigger: 'scroll-depth',
    options: { milestones: [1], container: '#nope' },
    targets: { log: 1 },
  },
});

type Send = (payload: unknown, event: TrackingEvent) => void;

let unmount: (() => void) | undefined;
let send: ReturnType<typeof vi.fn<Send>>;

/** 문서 높이·뷰포트·스크롤 위치를 흉내 낸다. */
function setViewport({ scrollHeight = 4000, innerHeight = 1000, scrollY = 0 } = {}) {
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

/** 스크롤 위치를 바꾸고 scroll 이벤트를 보낸 뒤 프레임을 넘긴다. */
function scrollTo(scrollY: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
  window.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(16);
}

/** body에 HTML을 넣고 scroll-depth 트리거로 mount한 뒤 첫 프레임을 넘긴다. */
function setup(html: string, debug = false) {
  document.body.innerHTML = html;
  send = vi.fn<Send>();
  unmount = observe(createTracker({ events, adapters: [{ name: 'log', send }], debug }), {
    triggers: [scrollDepthTrigger()],
  });
  vi.advanceTimersByTime(16);
}

const depths = () =>
  send.mock.calls.map(([payload]) => (payload as { scrollDepth: number }).scrollDepth);

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
  setViewport();
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('scrollDepthTrigger', () => {
  it('깊이가 milestone을 넘을 때마다 한 번씩 발화한다', () => {
    setup(`<div data-track="page"></div>`);
    expect(send).not.toHaveBeenCalled();

    scrollTo(750);
    expect(depths()).toEqual([0.25]);

    scrollTo(800);
    expect(depths()).toEqual([0.25]);

    scrollTo(1500);
    expect(depths()).toEqual([0.25, 0.5]);
  });

  it('여러 milestone을 한 번에 넘으면 순서대로 모두 발화한다', () => {
    setup(`<div data-track="page"></div>`);

    scrollTo(3000);

    expect(depths()).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('scrollDepth와 scrollDepthPercent를 params에 넣는다', () => {
    setup(`<div data-track="page" data-track-slug="a"></div>`);

    scrollTo(750);

    expect(send).toHaveBeenCalledWith(
      { slug: 'a', scrollDepth: 0.25, scrollDepthPercent: 25 },
      expect.objectContaining({ key: 'page', trigger: 'scroll-depth' }),
    );
  });

  it('스크롤할 수 없는 문서는 깊이 1로 보고 바로 발화한다', () => {
    setViewport({ scrollHeight: 800, innerHeight: 1000 });
    setup(`<div data-track="page"></div>`);

    expect(depths()).toEqual([0.25, 0.5, 0.75, 1]);
  });

  it('끝에서 2px 이내면 1로 본다', () => {
    setup(`<div data-track="page"></div>`);

    scrollTo(2998);

    expect(depths()).toContain(1);
  });

  it('milestone을 0~1로 자르고 중복을 없애고 정렬한다', () => {
    setup(`<div data-track="messy"></div>`);

    scrollTo(3000);

    expect(depths()).toEqual([0, 0.5, 1]);
  });

  it('milestone이 비어 있으면 경고하고 붙이지 않는다', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setup(`<div data-track="empty"></div>`, true);

    scrollTo(3000);

    expect(send).not.toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toContain('milestone');
  });

  it('요소가 여러 개여도 window 리스너는 한 쌍만 붙이고 다 끝나면 뗀다', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    setup(`<div data-track="page"></div><div data-track="page"></div>`);

    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);

    scrollTo(3000);

    expect(send).toHaveBeenCalledTimes(8);
    expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
  });

  it('요소가 제거되면 더 발화하지 않는다', async () => {
    setup(`<div data-track="page"></div>`);
    scrollTo(750);

    document.querySelector('div')?.remove();
    await vi.advanceTimersByTimeAsync(0);
    scrollTo(3000);

    expect(depths()).toEqual([0.25]);
  });

  describe('container', () => {
    /** 스크롤 요소를 만들어 높이·위치를 흉내 낸다. */
    function makeFeed(scrollTop = 0) {
      const feed = document.createElement('div');
      feed.id = 'feed';
      Object.defineProperty(feed, 'scrollHeight', { configurable: true, value: 2000 });
      Object.defineProperty(feed, 'clientHeight', { configurable: true, value: 1000 });
      Object.defineProperty(feed, 'scrollTop', {
        configurable: true,
        value: scrollTop,
        writable: true,
      });
      return feed;
    }

    it('지정한 요소의 스크롤 깊이를 본다', () => {
      const add = vi.spyOn(window, 'addEventListener');
      document.body.innerHTML = '';
      const feed = makeFeed();
      feed.innerHTML = `<div data-track="feed"></div>`;
      document.body.append(feed);
      send = vi.fn<Send>();
      unmount = observe(createTracker({ events, adapters: [{ name: 'log', send }] }), {
        triggers: [scrollDepthTrigger()],
      });
      vi.advanceTimersByTime(16);
      expect(send).not.toHaveBeenCalled();
      expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0);

      feed.scrollTop = 500;
      feed.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(16);
      expect(depths()).toEqual([0.5]);

      feed.scrollTop = 1000;
      feed.dispatchEvent(new Event('scroll'));
      vi.advanceTimersByTime(16);
      expect(depths()).toEqual([0.5, 1]);
    });

    it('요소가 없으면 경고하고 붙이지 않는다', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      setup(`<div data-track="missing"></div>`, true);

      expect(send).not.toHaveBeenCalled();
      expect(warn.mock.calls[0]?.[0]).toContain('#nope');
    });
  });

  it('unmount하면 리스너를 뗀다', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    setup(`<div data-track="page"></div>`);

    unmount?.();
    unmount = undefined;
    scrollTo(3000);

    expect(send).not.toHaveBeenCalled();
    expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1);
  });
});
