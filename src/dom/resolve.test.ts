import { afterEach, describe, expect, it, vi } from 'vitest';

import { bindParams } from './params';
import { resolveElement } from './resolve';

/** HTML 문자열을 body에 넣고 첫 `[data-track]` 요소를 돌려준다. */
function mount(html: string, selector = '[data-track]'): Element {
  document.body.innerHTML = html;
  const el = document.body.querySelector(selector);
  if (!el) throw new Error(`no element for ${selector}`);
  return el;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolveElement', () => {
  it('data-track이 없거나 비어 있으면 null이다', () => {
    expect(resolveElement(mount('<div></div>', 'div'))).toBeNull();
    expect(resolveElement(mount('<div data-track=""></div>', 'div'))).toBeNull();
  });

  it('키만 있으면 params는 빈 객체다', () => {
    expect(resolveElement(mount('<button data-track="banner-click"></button>'))).toEqual({
      key: 'banner-click',
      params: {},
    });
  });

  it('개별 속성을 camelCase 키로 읽는다', () => {
    const el = mount(
      '<button data-track="banner-click" data-track-banner-id="b1" data-track-position="2" data-track-a-b-c="x"></button>',
    );
    expect(resolveElement(el)?.params).toEqual({ bannerId: 'b1', position: '2', aBC: 'x' });
  });

  it('data-track-params JSON을 읽고 개별 속성보다 우선한다', () => {
    const el = mount(
      `<button data-track="banner-click" data-track-banner-id="attr" data-track-params='{"bannerId":"json","price":1200}'></button>`,
    );
    expect(resolveElement(el)?.params).toEqual({ bannerId: 'json', price: 1200 });
  });

  it('잘못된 JSON은 무시하고 warn을 부른다', () => {
    const warn = vi.fn();
    const el = mount(
      `<button data-track="banner-click" data-track-id="1" data-track-params='{oops'></button>`,
    );
    expect(resolveElement(el, { warn })?.params).toEqual({ id: '1' });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain('not valid JSON');
  });

  it('객체가 아닌 JSON도 무시한다', () => {
    const warn = vi.fn();
    const el = mount(`<button data-track="k" data-track-params='[1,2]'></button>`);
    expect(resolveElement(el, { warn })?.params).toEqual({});
    expect(warn.mock.calls[0]?.[0]).toContain('must be a JSON object');
  });

  it('조상의 ctx를 병합하고 가까운 조상이 먼 조상을 덮는다', () => {
    const el = mount(`
      <main data-track-ctx-page="home" data-track-ctx-section="root">
        <section data-track-ctx-section="hero" data-track-ctx='{"variant":"b"}'>
          <button data-track="banner-click" data-track-banner-id="b1"></button>
        </section>
      </main>`);
    expect(resolveElement(el)?.params).toEqual({
      page: 'home',
      section: 'hero',
      variant: 'b',
      bannerId: 'b1',
    });
  });

  it('요소 자신의 ctx는 자신의 params보다 약하다', () => {
    const el = mount(
      `<button data-track="k" data-track-ctx-source="ctx" data-track-source="own"></button>`,
    );
    expect(resolveElement(el)?.params).toEqual({ source: 'own' });
  });

  it('ctx 속성을 개별 params로 읽지 않는다', () => {
    const el = mount(
      `<button data-track="k" data-track-ctx-a="1" data-track-ctx='{"b":2}'></button>`,
    );
    expect(resolveElement(el)?.params).toEqual({ a: '1', b: 2 });
  });

  it('bindParams로 붙인 값이 속성보다 우선하고 직렬화되지 않는다', () => {
    const el = mount(
      `<button data-track="k" data-track-id="attr" data-track-params='{"id":"json","n":"1"}'></button>`,
    );
    const nested = { deep: true };
    bindParams(el, { id: 'bound', nested, n: 1 });

    const params = resolveElement(el)?.params;
    expect(params).toEqual({ id: 'bound', n: 1, nested });
    expect(params?.nested).toBe(nested);
  });

  it('getter를 붙이면 읽을 때마다 호출한다', () => {
    const el = mount(`<button data-track="k"></button>`);
    let count = 0;
    bindParams(el, () => ({ count: ++count }));

    expect(resolveElement(el)?.params).toEqual({ count: 1 });
    expect(resolveElement(el)?.params).toEqual({ count: 2 });
  });

  it('null을 붙이면 뗀다', () => {
    const el = mount(`<button data-track="k" data-track-id="attr"></button>`);
    bindParams(el, { id: 'bound' });
    bindParams(el, null);

    expect(resolveElement(el)?.params).toEqual({ id: 'attr' });
  });

  it('prefix를 바꿀 수 있다', () => {
    const el = mount(
      `<main data-analytics-ctx-page="p"><button data-analytics="k" data-analytics-id="1" data-track-id="ignored"></button></main>`,
      '[data-analytics]',
    );
    expect(resolveElement(el, { prefix: 'data-analytics' })).toEqual({
      key: 'k',
      params: { page: 'p', id: '1' },
    });
  });
});
