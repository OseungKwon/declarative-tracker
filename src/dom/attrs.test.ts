import { describe, expect, it } from 'vitest';

import { trackAttrs } from './attrs';
import { resolveElement } from './resolve';

describe('trackAttrs', () => {
  it('키만 주면 data-track만 만든다', () => {
    expect(trackAttrs('banner-click')).toEqual({ 'data-track': 'banner-click' });
    expect(trackAttrs('banner-click', {})).toEqual({ 'data-track': 'banner-click' });
  });

  it('params는 JSON 속성으로 넣는다', () => {
    expect(trackAttrs('banner-click', { id: 'b1', price: 1200 })).toEqual({
      'data-track': 'banner-click',
      'data-track-params': '{"id":"b1","price":1200}',
    });
  });

  it('prefix를 바꿀 수 있다', () => {
    expect(trackAttrs('k', { a: 1 }, 'data-analytics')).toEqual({
      'data-analytics': 'k',
      'data-analytics-params': '{"a":1}',
    });
  });

  it('resolveElement가 그대로 읽는다', () => {
    const el = document.createElement('div');
    for (const [name, value] of Object.entries(trackAttrs('k', { id: 'x' }))) {
      el.setAttribute(name, value);
    }
    expect(resolveElement(el)).toEqual({ key: 'k', params: { id: 'x' } });
  });
});
