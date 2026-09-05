import type { TriggerName } from '../../core/types';
import { defineTrigger, type Trigger } from '../trigger';

export interface DelegatedTriggerOptions {
  phase?: 'capture' | 'bubble';
}

/** root에 DOM 이벤트 리스너 하나를 두고, 이벤트가 난 곳에서 가장 가까운 data-track 요소를 트리거한다. */
export function delegatedTrigger<T extends TriggerName>(
  name: T,
  eventType: string,
  options: DelegatedTriggerOptions = {},
): Trigger<T> {
  const capture = options.phase !== 'bubble';
  return defineTrigger({
    name,
    setup({ root, prefix, fire }) {
      const selector = `[${prefix}]`;
      const listener = (event: Event) => {
        if (!(event.target instanceof Element)) return;
        const el = event.target.closest(selector);
        if (el && root.contains(el)) fire(el);
      };
      root.addEventListener(eventType, listener, capture);
      return {
        attach: () => undefined,
        destroy: () => {
          root.removeEventListener(eventType, listener, capture);
        },
      };
    },
  });
}
