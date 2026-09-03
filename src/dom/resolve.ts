import type { Params } from '../core/types';

export interface ResolveOptions {
  prefix?: string;
  warn?: (message: string) => void;
}

export interface ResolvedElement {
  key: string;
  params: Params;
}

export const DEFAULT_PREFIX = 'data-track';

/** 케밥 케이스를 camelCase로 바꾼다. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

/** JSON 속성을 객체로 읽는다. 실패하면 빈 객체를 돌려준다. */
function readJson(el: Element, attr: string, warn?: (message: string) => void): Params {
  const raw = el.getAttribute(attr);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Params;
    }
    warn?.(`${attr} must be a JSON object: ${raw}`);
  } catch {
    warn?.(`${attr} is not valid JSON: ${raw}`);
  }
  return {};
}

/** `<attrPrefix>-foo-bar="x"` 꼴의 개별 속성을 `{ fooBar: 'x' }`로 모은다. */
function readIndividual(el: Element, attrPrefix: string, skip: string[]): Params {
  const params: Params = {};
  const head = `${attrPrefix}-`;
  for (const { name, value } of el.attributes) {
    if (!name.startsWith(head) || skip.some((s) => name === s || name.startsWith(`${s}-`))) {
      continue;
    }
    params[toCamelCase(name.slice(head.length))] = value;
  }
  return params;
}

/** 요소에서 이벤트 키와 params를 읽는다. 조상의 ctx < 개별 속성 < JSON 순으로 덮어쓴다. */
export function resolveElement(el: Element, options: ResolveOptions = {}): ResolvedElement | null {
  const { prefix = DEFAULT_PREFIX, warn } = options;
  const key = el.getAttribute(prefix);
  if (!key) return null;

  const paramsAttr = `${prefix}-params`;
  const ctxAttr = `${prefix}-ctx`;

  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) chain.unshift(node);

  let params: Params = {};
  for (const node of chain) {
    params = { ...params, ...readIndividual(node, ctxAttr, []), ...readJson(node, ctxAttr, warn) };
  }

  return {
    key,
    params: {
      ...params,
      ...readIndividual(el, prefix, [paramsAttr, ctxAttr]),
      ...readJson(el, paramsAttr, warn),
    },
  };
}
