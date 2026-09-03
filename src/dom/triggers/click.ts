import { defineTrigger } from '../trigger';

/** root에 캡처 단계 클릭 리스너 하나를 두고 가장 가까운 data-track 요소를 발화한다. */
export function clickTrigger() {
  return defineTrigger({
    name: 'click',
    setup({ root, prefix, fire }) {
      const selector = `[${prefix}]`;
      const onClick = (event: Event) => {
        if (!(event.target instanceof Element)) return;
        const el = event.target.closest(selector);
        if (el && root.contains(el)) fire(el);
      };
      root.addEventListener('click', onClick, true);
      return {
        attach: () => undefined,
        destroy: () => {
          root.removeEventListener('click', onClick, true);
        },
      };
    },
  });
}
