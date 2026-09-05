import type { Tracker } from '../core/tracker';
import type { EventDefinition, Params, TriggerName } from '../core/types';
import { DEFAULT_PREFIX, resolveElement } from './resolve';
import type { Trigger, TriggerInstance } from './trigger';
import { defaultTriggers } from './triggers';

export interface ObserveOptions {
  root?: Element;
  prefix?: string;
  triggers?: Trigger[];
}

export type Unobserve = () => void;

const noop: Unobserve = () => undefined;

/** root 아래의 data-track 요소를 찾아 트리거에 연결하고, DOM 변경을 계속 감시한다. */
export function observe(tracker: Tracker, options: ObserveOptions = {}): Unobserve {
  if (typeof document === 'undefined') return noop;

  const { root = document.body, prefix = DEFAULT_PREFIX, triggers = defaultTriggers() } = options;
  const { events, logger } = tracker;
  const selector = `[${prefix}]`;
  const warn = (message: string) => {
    logger.warn(message);
  };

  const instances = new Map<TriggerName, TriggerInstance>();
  for (const trigger of triggers) {
    if (instances.has(trigger.name)) {
      throw new Error(`[declarative-tracker] duplicate trigger name "${trigger.name}"`);
    }
    instances.set(
      trigger.name,
      trigger.setup({
        root,
        prefix,
        logger,
        fire: (el, extra) => fireFrom(el, trigger.name, extra),
      }),
    );
  }

  let attached = new WeakMap<Element, TriggerInstance>();
  const warnedTriggers = new Set<string>();

  /** 요소의 params를 지금 읽어서 fire한다. 키의 트리거가 다르면 보내지 않는다. */
  function fireFrom(el: Element, trigger: TriggerName, extra?: Params): boolean {
    const resolved = resolveElement(el, { prefix, warn });
    if (!resolved) return false;
    const definition = events[resolved.key];
    if (definition?.trigger !== trigger) return false;

    const params = extra ? { ...resolved.params, ...extra } : resolved.params;
    (tracker as Tracker<Record<string, EventDefinition>>).fire(resolved.key, params, {
      trigger,
      element: el,
    });
    return true;
  }

  /** 키만 읽어 트리거에 연결한다. params는 전송 시점에 읽는다. */
  function attach(el: Element): void {
    if (attached.has(el)) return;
    const key = el.getAttribute(prefix);
    if (!key) return;
    const definition = events[key];
    if (!definition) {
      warn(`no event named "${key}"`);
      return;
    }
    if (definition.trigger === 'manual') return;

    const instance = instances.get(definition.trigger);
    if (!instance) {
      if (!warnedTriggers.has(definition.trigger)) {
        warnedTriggers.add(definition.trigger);
        warn(`no trigger registered for "${definition.trigger}" (used by event "${key}")`);
      }
      return;
    }
    instance.attach(el, definition.options);
    attached.set(el, instance);
  }

  function detach(el: Element): void {
    const instance = attached.get(el);
    if (!instance) return;
    instance.detach?.(el);
    attached.delete(el);
  }

  /** node 자신과 하위의 data-track 요소를 순회한다. */
  function eachTracked(node: Node, visit: (el: Element) => void): void {
    if (!(node instanceof Element)) return;
    if (node.hasAttribute(prefix)) visit(node);
    if (node.childElementCount > 0) node.querySelectorAll(selector).forEach(visit);
  }

  /** 제거된 요소를 먼저 떼고 추가된 요소를 붙인다. 이동한 요소는 붙어 있는 채로 둔다. */
  function onMutations(records: MutationRecord[]): void {
    const added: Node[] = [];
    for (const record of records) {
      if (record.type === 'attributes') {
        const el = record.target as Element;
        if (record.oldValue === el.getAttribute(prefix)) continue;
        detach(el);
        attach(el);
        continue;
      }
      record.removedNodes.forEach((node) => {
        eachTracked(node, (el) => {
          if (!el.isConnected) detach(el);
        });
      });
      added.push(...record.addedNodes);
    }
    for (const node of added) {
      if (node.isConnected) eachTracked(node, attach);
    }
  }

  eachTracked(root, attach);

  const observer = new MutationObserver(onMutations);
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [prefix],
    attributeOldValue: true,
  });

  let unmounted = false;
  return () => {
    if (unmounted) return;
    unmounted = true;
    observer.disconnect();
    for (const instance of instances.values()) instance.destroy();
    attached = new WeakMap();
  };
}
