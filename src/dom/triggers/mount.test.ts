import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../../core/define';
import { createTracker } from '../../core/tracker';
import type { TrackingEvent } from '../../core/types';
import { mount } from '../mount';
import { mountTrigger } from './mount';

const events = defineEvents({
  'page-view': { trigger: 'mount', targets: { log: (e) => e.params } },
});

type Send = (payload: unknown, event: TrackingEvent) => void;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let unmount: (() => void) | undefined;
let send: ReturnType<typeof vi.fn<Send>>;

beforeEach(() => {
  document.body.innerHTML = '';
  send = vi.fn<Send>();
  unmount = mount(createTracker({ events, adapters: [{ name: 'log', send }] }), {
    triggers: [mountTrigger()],
  });
});

afterEach(() => {
  unmount?.();
});

describe('mountTrigger', () => {
  it('요소가 추가되면 바로 발화한다', async () => {
    const el = document.createElement('div');
    el.setAttribute('data-track', 'page-view');
    el.setAttribute('data-track-slug', 'hello');
    document.body.append(el);
    await flush();

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      { slug: 'hello' },
      expect.objectContaining({ key: 'page-view', trigger: 'mount', element: el }),
    );
  });

  it('같은 요소가 옮겨져도 다시 발화하지 않는다', async () => {
    document.body.innerHTML = `<div id="a"><p data-track="page-view"></p></div><div id="b"></div>`;
    await flush();
    const p = document.querySelector('p');
    if (!p) throw new Error('no p');

    document.getElementById('b')?.append(p);
    await flush();

    expect(send).toHaveBeenCalledOnce();
  });

  it('요소를 새로 만들면 다시 발화한다', async () => {
    document.body.innerHTML = `<p data-track="page-view"></p>`;
    await flush();
    document.body.innerHTML = `<p data-track="page-view"></p>`;
    await flush();

    expect(send).toHaveBeenCalledTimes(2);
  });
});
