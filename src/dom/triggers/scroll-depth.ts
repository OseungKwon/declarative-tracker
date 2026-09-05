import { subscribeScrollDepth } from '../scroll-source';
import { defineTrigger } from '../trigger';

/** 0~1로 자르고 중복을 없앤 뒤 오름차순으로 정렬한다. */
function normalizeMilestones(milestones: number[]): number[] {
  return [...new Set(milestones.map((m) => Math.min(1, Math.max(0, m))))].sort((a, b) => a - b);
}

/** 스크롤 깊이가 각 milestone을 넘을 때마다 한 번씩 보낸다. 기본은 문서, container로 스크롤 요소를 지정할 수 있다. */
export function scrollDepthTrigger() {
  return defineTrigger({
    name: 'scroll-depth',
    setup({ fire, logger }) {
      const unsubscribes = new Map<Element, () => void>();

      const stop = (el: Element) => {
        unsubscribes.get(el)?.();
        unsubscribes.delete(el);
      };

      return {
        attach(el, options) {
          const milestones = normalizeMilestones(options?.milestones ?? []);
          if (milestones.length === 0) {
            logger.warn('scroll-depth needs at least one milestone');
            return;
          }
          const target = options?.container ? document.querySelector(options.container) : window;
          if (!target) {
            logger.warn(`scroll-depth container not found: ${options?.container ?? ''}`);
            return;
          }

          const fired = new Set<number>();
          const unsubscribe = subscribeScrollDepth(target, (depth) => {
            for (const milestone of milestones) {
              if (fired.has(milestone) || depth < milestone) continue;
              fired.add(milestone);
              fire(el, { scrollDepth: milestone, scrollDepthPercent: Math.round(milestone * 100) });
            }
            if (fired.size === milestones.length) stop(el);
          });
          unsubscribes.set(el, unsubscribe);
        },
        detach: stop,
        destroy() {
          for (const unsubscribe of unsubscribes.values()) unsubscribe();
          unsubscribes.clear();
        },
      };
    },
  });
}
