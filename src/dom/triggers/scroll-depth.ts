import { defineTrigger } from '../trigger';

type DepthListener = (depth: number) => void;

const listeners = new Set<DepthListener>();
let rafId = 0;
let listening = false;

/** 문서 전체 기준 스크롤 깊이(0~1). 스크롤할 수 없으면 1이다. */
function documentScrollDepth(): number {
  const root = document.documentElement;
  const scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
  if (scrollable === 0) return 1;
  const scrollTop = window.scrollY;
  if (scrollable - scrollTop <= 2) return 1;
  return Math.min(1, Math.max(0, scrollTop / scrollable));
}

/** 다음 프레임에 깊이를 한 번만 계산해 구독자에게 알린다. */
function schedule(): void {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    const depth = documentScrollDepth();
    for (const listener of listeners) listener(depth);
  });
}

/** scroll/resize 리스너는 모듈 전체에서 한 쌍만 둔다. */
function subscribe(listener: DepthListener): () => void {
  listeners.add(listener);
  if (!listening) {
    listening = true;
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
  }
  schedule();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0 || !listening) return;
    listening = false;
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    cancelAnimationFrame(rafId);
    rafId = 0;
  };
}

/** 0~1로 자르고 중복을 없앤 뒤 오름차순으로 정렬한다. */
function normalizeMilestones(milestones: number[]): number[] {
  return [...new Set(milestones.map((m) => Math.min(1, Math.max(0, m))))].sort((a, b) => a - b);
}

interface Registration {
  milestones: number[];
  fired: Set<number>;
}

/** 문서 스크롤 깊이가 각 milestone을 넘을 때마다 한 번씩 발화한다. */
export function scrollDepthTrigger() {
  return defineTrigger({
    name: 'scroll-depth',
    setup({ fire, logger }) {
      const registrations = new Map<Element, Registration>();
      let unsubscribe: (() => void) | undefined;

      const onDepth = (depth: number) => {
        for (const [el, registration] of registrations) {
          for (const milestone of registration.milestones) {
            if (registration.fired.has(milestone) || depth < milestone) continue;
            registration.fired.add(milestone);
            fire(el, { scrollDepth: milestone, scrollDepthPercent: Math.round(milestone * 100) });
          }
          if (registration.fired.size === registration.milestones.length) registrations.delete(el);
        }
        if (registrations.size === 0) stop();
      };

      const stop = () => {
        unsubscribe?.();
        unsubscribe = undefined;
      };

      return {
        attach(el, options) {
          const milestones = normalizeMilestones(options?.milestones ?? []);
          if (milestones.length === 0) {
            logger.warn('scroll-depth needs at least one milestone');
            return;
          }
          registrations.set(el, { milestones, fired: new Set() });
          unsubscribe ??= subscribe(onDepth);
        },
        detach(el) {
          registrations.delete(el);
          if (registrations.size === 0) stop();
        },
        destroy() {
          registrations.clear();
          stop();
        },
      };
    },
  });
}
