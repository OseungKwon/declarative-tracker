import { defineTrigger } from '../trigger';

/** root에 캡처 단계 submit 리스너 하나를 두고 폼에서 가장 가까운 data-track 요소의 이벤트를 보낸다. */
export function submitTrigger() {
  return defineTrigger({
    name: 'submit',
    setup({ root, prefix, fire }) {
      const selector = `[${prefix}]`;
      const onSubmit = (event: Event) => {
        if (!(event.target instanceof Element)) return;
        const el = event.target.closest(selector);
        if (el && root.contains(el)) fire(el);
      };
      root.addEventListener('submit', onSubmit, true);
      return {
        attach: () => undefined,
        destroy: () => {
          root.removeEventListener('submit', onSubmit, true);
        },
      };
    },
  });
}
