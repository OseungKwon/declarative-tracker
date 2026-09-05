import { defineTrigger } from '../trigger';

export interface ClickTriggerOptions {
  phase?: 'capture' | 'bubble';
}

/** root에 클릭 리스너 하나를 두고 가장 가까운 data-track 요소의 이벤트를 보낸다. 기본은 캡처 단계다. */
export function clickTrigger(options: ClickTriggerOptions = {}) {
  const capture = options.phase !== 'bubble';
  return defineTrigger({
    name: 'click',
    setup({ root, prefix, fire }) {
      const selector = `[${prefix}]`;
      const onClick = (event: Event) => {
        if (!(event.target instanceof Element)) return;
        const el = event.target.closest(selector);
        if (el && root.contains(el)) fire(el);
      };
      root.addEventListener('click', onClick, capture);
      return {
        attach: () => undefined,
        destroy: () => {
          root.removeEventListener('click', onClick, capture);
        },
      };
    },
  });
}
