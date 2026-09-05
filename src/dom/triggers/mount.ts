import { defineTrigger } from '../trigger';

/** 요소가 DOM에 붙는 즉시 발화한다. 중복 방지는 observe()의 레지스트리가 맡는다. */
export function mountTrigger() {
  return defineTrigger({
    name: 'mount',
    setup({ fire }) {
      return {
        attach: (el) => {
          fire(el);
        },
        destroy: () => undefined,
      };
    },
  });
}
