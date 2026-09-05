import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../../core/define';
import { createTracker } from '../../core/tracker';
import type { TrackingEvent } from '../../core/types';
import { observe } from '../observe';
import { clickTrigger } from './click';

const events = defineEvents({
  'banner-click': { trigger: 'click', targets: { log: (e) => e.params } },
  'hero-view': { trigger: 'impression', targets: { log: 1 } },
});

let unmount: (() => void) | undefined;
type Send = (payload: unknown, event: TrackingEvent) => void;

let send: ReturnType<typeof vi.fn<Send>>;

/** body에 HTML을 넣고 click 트리거로 mount한다. */
function setup(html: string, trigger = clickTrigger()) {
  document.body.innerHTML = html;
  send = vi.fn<Send>();
  const tracker = createTracker({ events, adapters: [{ name: 'log', send }] });
  unmount = observe(tracker, { triggers: [trigger] });
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe('clickTrigger', () => {
  it('자식을 클릭해도 가장 가까운 data-track 요소로 보낸다', () => {
    setup(`<button data-track="banner-click" data-track-id="1"><span>go</span></button>`);

    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      { id: '1' },
      expect.objectContaining({ key: 'banner-click', trigger: 'click' }),
    );
  });

  it('data-track 밖을 클릭하면 아무 일도 없다', () => {
    setup(`<button data-track="banner-click"></button><p>plain</p>`);

    document.querySelector('p')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).not.toHaveBeenCalled();
  });

  it('click이 아닌 트리거의 키는 보내지 않는다', () => {
    setup(`<div data-track="hero-view"></div>`);

    document.querySelector('div')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).not.toHaveBeenCalled();
  });

  it('버블 단계에서 stopPropagation해도 보낸다', () => {
    setup(`<button data-track="banner-click"><span>go</span></button>`);
    const span = document.querySelector('span');
    span?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    span?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).toHaveBeenCalledOnce();
  });

  it("phase가 'bubble'이면 stopPropagation된 클릭은 보내지 않는다", () => {
    setup(
      `<button data-track="banner-click"><span>go</span></button><button data-track="banner-click" id="other"></button>`,
      clickTrigger({ phase: 'bubble' }),
    );
    const span = document.querySelector('span');
    span?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    span?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(send).not.toHaveBeenCalled();

    document.getElementById('other')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(send).toHaveBeenCalledOnce();
  });

  it('root 바깥의 조상은 무시한다', () => {
    document.body.innerHTML = `<div data-track="banner-click"><section id="root"><span>x</span></section></div>`;
    const root = document.getElementById('root');
    if (!root) throw new Error('no root');
    send = vi.fn<Send>();
    unmount = observe(createTracker({ events, adapters: [{ name: 'log', send }] }), {
      root,
      triggers: [clickTrigger()],
    });

    document.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).not.toHaveBeenCalled();
  });

  it('unmount하면 리스너를 뗀다', () => {
    setup(`<button data-track="banner-click"></button>`);

    unmount?.();
    unmount = undefined;
    document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(send).not.toHaveBeenCalled();
  });
});
