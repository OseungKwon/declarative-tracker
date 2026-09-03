import { defineTrigger } from '../trigger';

type DepthListener = (depth: number) => void;
type ScrollTarget = Window | Element;

interface Source {
  listeners: Set<DepthListener>;
  rafId: number;
  schedule: () => void;
}

const sources = new Map<ScrollTarget, Source>();

/** 스크롤 깊이(0~1). 스크롤할 수 없으면 1이다. */
function depthOf(target: ScrollTarget): number {
  const isElement = target instanceof Element;
  const scrollable = isElement
    ? target.scrollHeight - target.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const scrollTop = isElement ? target.scrollTop : window.scrollY;
  if (scrollable - scrollTop <= 2) return 1;
  return Math.min(1, Math.max(0, scrollTop / scrollable));
}

/** 같은 스크롤 대상에는 리스너 한 쌍만 붙이고, 프레임당 한 번 깊이를 계산해 알린다. */
function subscribe(target: ScrollTarget, listener: DepthListener): () => void {
  let source = sources.get(target);
  if (!source) {
    const created: Source = {
      listeners: new Set(),
      rafId: 0,
      schedule: () => {
        if (created.rafId) return;
        created.rafId = requestAnimationFrame(() => {
          created.rafId = 0;
          const depth = depthOf(target);
          for (const l of created.listeners) l(depth);
        });
      },
    };
    target.addEventListener('scroll', created.schedule, { passive: true });
    if (!(target instanceof Element)) target.addEventListener('resize', created.schedule);
    sources.set(target, created);
    source = created;
  }
  source.listeners.add(listener);
  source.schedule();

  return () => {
    if (!source.listeners.delete(listener) || source.listeners.size > 0) return;
    target.removeEventListener('scroll', source.schedule);
    if (!(target instanceof Element)) target.removeEventListener('resize', source.schedule);
    cancelAnimationFrame(source.rafId);
    sources.delete(target);
  };
}

/** 0~1로 자르고 중복을 없앤 뒤 오름차순으로 정렬한다. */
function normalizeMilestones(milestones: number[]): number[] {
  return [...new Set(milestones.map((m) => Math.min(1, Math.max(0, m))))].sort((a, b) => a - b);
}

/** 스크롤 깊이가 각 milestone을 넘을 때마다 한 번씩 발화한다. 기본은 문서, container로 스크롤 요소를 지정할 수 있다. */
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
          const unsubscribe = subscribe(target, (depth) => {
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
