import { act, cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../core/define';
import { createTracker } from '../core/tracker';
import type { TrackingEvent } from '../core/types';
import { trackAttrs } from '../dom/attrs';
import { createTrackingHooks, useFire, useTracker } from './hooks';
import { TrackingProvider } from './provider';

const events = defineEvents({
  'banner-click': {
    trigger: 'click',
    params: {} as { id: string },
    targets: { log: (e) => e.params },
  },
  'page-view': { trigger: 'mount', targets: { log: (e) => e.params } },
  ping: { trigger: 'manual', targets: { log: 1 } },
});

type Send = (payload: unknown, event: TrackingEvent) => void;

/** 기록용 어댑터가 붙은 tracker를 만든다. */
function makeTracker() {
  const send = vi.fn<Send>();
  const tracker = createTracker({ events, adapters: [{ name: 'log', send }] });
  return { tracker, send };
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

afterEach(() => {
  cleanup();
});

describe('TrackingProvider', () => {
  it('마운트되면 DOM 감시를 시작한다', async () => {
    const { tracker, send } = makeTracker();
    const { getByText, unmount } = render(
      <TrackingProvider tracker={tracker}>
        <button {...trackAttrs('banner-click', { id: 'b1' })}>go</button>
      </TrackingProvider>,
    );
    await flush();

    getByText('go').click();
    expect(send).toHaveBeenCalledWith({ id: 'b1' }, expect.objectContaining({ trigger: 'click' }));

    unmount();
    document.body.innerHTML = `<button data-track="banner-click">late</button>`;
    document.querySelector('button')?.click();
    expect(send).toHaveBeenCalledOnce();
  });

  it('mount={false}면 DOM을 감시하지 않는다', async () => {
    const { tracker, send } = makeTracker();
    render(
      <TrackingProvider tracker={tracker} mount={false}>
        <div data-track="page-view" />
      </TrackingProvider>,
    );
    await flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('mountOptions를 mount에 넘긴다', async () => {
    const { tracker, send } = makeTracker();
    render(
      <TrackingProvider tracker={tracker} mountOptions={{ prefix: 'data-analytics' }}>
        <div data-analytics="page-view" data-analytics-slug="a" />
        <div data-track="page-view" />
      </TrackingProvider>,
    );
    await flush();

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({ slug: 'a' }, expect.anything());
  });
});

describe('useTracker', () => {
  it('Provider 밖에서 부르면 throw한다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useTracker())).toThrow('TrackingProvider');
    vi.restoreAllMocks();
  });

  it('Provider의 tracker를 돌려준다', () => {
    const { tracker } = makeTracker();
    const { result } = renderHook(() => useTracker(), {
      wrapper: ({ children }) => (
        <TrackingProvider tracker={tracker} mount={false}>
          {children}
        </TrackingProvider>
      ),
    });
    expect(result.current).toBe(tracker);
  });
});

describe('useFire', () => {
  const { tracker, send } = makeTracker();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TrackingProvider tracker={tracker} mount={false}>
      {children}
    </TrackingProvider>
  );

  it('키 없이 부르면 tracker.fire를 돌려준다', () => {
    const { result } = renderHook(() => useFire<typeof events>(), { wrapper });
    result.current('ping');
    expect(send).toHaveBeenCalledWith(1, expect.objectContaining({ key: 'ping' }));
  });

  it('키를 주면 그 키에 묶인 함수를 돌려주고 리렌더에도 같은 참조다', () => {
    const { result, rerender } = renderHook(
      () => useFire<typeof events, 'banner-click'>('banner-click'),
      { wrapper },
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);

    first({ id: 'x' });
    expect(send).toHaveBeenCalledWith(
      { id: 'x' },
      expect.objectContaining({ key: 'banner-click' }),
    );
  });
});

describe('createTrackingHooks', () => {
  it('맵 타입이 고정된 훅을 돌려준다', () => {
    const { tracker, send } = makeTracker();
    const hooks = createTrackingHooks<typeof events>();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <TrackingProvider tracker={tracker} mount={false}>
        {children}
      </TrackingProvider>
    );

    const { result } = renderHook(
      () => ({
        tracker: hooks.useTracker(),
        fire: hooks.useFire(),
        fireBanner: hooks.useFire('banner-click'),
      }),
      { wrapper },
    );

    expect(result.current.tracker).toBe(tracker);
    result.current.fire('ping');
    result.current.fireBanner({ id: 'y' });
    expect(send).toHaveBeenCalledTimes(2);
  });
});
