import type { Params } from '../core/types';
import { boundParams } from './params';

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

/** JSON 속성을 읽어 into에 덮어쓴다. 객체가 아니거나 깨졌으면 무시한다. */
function assignJson(into: Params, el: Element, attr: string, warn?: (message: string) => void) {
  const raw = el.getAttribute(attr);
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      Object.assign(into, parsed);
      return;
    }
    warn?.(`${attr} must be a JSON object: ${raw}`);
  } catch {
    warn?.(`${attr} is not valid JSON: ${raw}`);
  }
}

/** `<attrPrefix>-foo-bar="x"` 꼴의 개별 속성을 `{ fooBar: 'x' }`로 into에 덮어쓴다. */
function assignIndividual(into: Params, el: Element, attrPrefix: string, skip: string[]) {
  const head = `${attrPrefix}-`;
  for (const { name, value } of el.attributes) {
    if (!name.startsWith(head) || skip.some((s) => name === s || name.startsWith(`${s}-`))) {
      continue;
    }
    into[toCamelCase(name.slice(head.length))] = value;
  }
}

/** 요소에서 이벤트 키와 params를 읽는다. 조상의 ctx < 개별 속성 < JSON < bindParams 순으로 덮어쓴다. */
export function resolveElement(el: Element, options: ResolveOptions = {}): ResolvedElement | null {
  const { prefix = DEFAULT_PREFIX, warn } = options;
  const key = el.getAttribute(prefix);
  if (!key) return null;

  const paramsAttr = `${prefix}-params`;
  const ctxAttr = `${prefix}-ctx`;

  const chain: Element[] = [];
  for (let node: Element | null = el; node; node = node.parentElement) {
    if (node.hasAttributes()) chain.push(node);
  }

  const params: Params = {};
  for (const node of chain.reverse()) {
    assignIndividual(params, node, ctxAttr, []);
    assignJson(params, node, ctxAttr, warn);
  }
  assignIndividual(params, el, prefix, [paramsAttr, ctxAttr]);
  assignJson(params, el, paramsAttr, warn);
  Object.assign(params, boundParams(el));

  return { key, params };
}
