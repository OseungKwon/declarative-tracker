import { describe, expect, it } from 'vitest';

import { defineEvent, defineEvents } from './define';

describe('defineEvent', () => {
  it('정의 객체를 그대로 돌려준다', () => {
    const def = { trigger: 'click', targets: { ga4: { name: 'x' } } } as const;
    expect(defineEvent(def)).toBe(def);
  });
});

describe('defineEvents', () => {
  it('맵 객체를 그대로 돌려준다', () => {
    const events = { a: { trigger: 'mount', targets: {} } } as const;
    expect(defineEvents(events)).toBe(events);
  });
});
