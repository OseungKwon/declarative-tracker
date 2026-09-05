import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { defineEvents } from '../../core/define';
import { createTracker } from '../../core/tracker';
import type { TrackingEvent } from '../../core/types';
import { mount } from '../mount';
import { submitTrigger } from './submit';

const events = defineEvents({
  'newsletter-submit': { trigger: 'submit', targets: { log: (e) => e.params } },
  'banner-click': { trigger: 'click', targets: { log: 1 } },
});

type Send = (payload: unknown, event: TrackingEvent) => void;

let unmount: (() => void) | undefined;
let send: ReturnType<typeof vi.fn<Send>>;

/** body에 HTML을 넣고 submit 트리거로 mount한다. */
function setup(html: string) {
  document.body.innerHTML = html;
  send = vi.fn<Send>();
  const tracker = createTracker({ events, adapters: [{ name: 'log', send }] });
  unmount = mount(tracker, { triggers: [submitTrigger()] });
}

const submit = (form: Element | null) => {
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
};

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  unmount?.();
  unmount = undefined;
});

describe('submitTrigger', () => {
  it('폼이 제출되면 폼의 data-track 이벤트를 보낸다', () => {
    setup(`<form data-track="newsletter-submit" data-track-plan="pro"></form>`);

    submit(document.querySelector('form'));

    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(
      { plan: 'pro' },
      expect.objectContaining({ key: 'newsletter-submit', trigger: 'submit' }),
    );
  });

  it('data-track이 폼의 조상에 있어도 찾는다', () => {
    setup(`<section data-track="newsletter-submit"><form></form></section>`);

    submit(document.querySelector('form'));

    expect(send).toHaveBeenCalledOnce();
  });

  it('preventDefault된 제출도 보낸다', () => {
    setup(`<form data-track="newsletter-submit"></form>`);
    const form = document.querySelector('form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
    });

    submit(form);

    expect(send).toHaveBeenCalledOnce();
  });

  it('submit이 아닌 트리거의 키는 보내지 않는다', () => {
    setup(`<form data-track="banner-click"></form>`);

    submit(document.querySelector('form'));

    expect(send).not.toHaveBeenCalled();
  });

  it('unmount하면 리스너를 뗀다', () => {
    setup(`<form data-track="newsletter-submit"></form>`);

    unmount?.();
    unmount = undefined;
    submit(document.querySelector('form'));

    expect(send).not.toHaveBeenCalled();
  });
});
