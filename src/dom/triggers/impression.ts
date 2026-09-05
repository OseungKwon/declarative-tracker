import { defineTrigger } from '../trigger';

const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_ROOT_MARGIN = '0px';

interface Watched {
  observer: IntersectionObserver;
  threshold: number;
  rootMargin: string;
  minVisibleMs: number;
  once: boolean;
  adjusted: boolean;
}

/** 뷰포트보다 큰 요소는 threshold에 닿을 수 없으므로 "뷰포트의 threshold만큼 채움"으로 바꿔 계산한다. */
function neededRatio(entry: IntersectionObserverEntry, threshold: number): number {
  const rootHeight = entry.rootBounds?.height;
  const height = entry.boundingClientRect.height;
  if (!rootHeight || height <= rootHeight) return threshold;
  return Math.max(0.01, Math.round(((rootHeight * threshold) / height) * 100) / 100);
}

/** 요소가 뷰포트에 threshold 이상, minVisibleMs 이상 보이면 이벤트를 보낸다. once가 false면 다시 보일 때마다 보낸다. */
export function impressionTrigger() {
  return defineTrigger({
    name: 'impression',
    setup({ fire }) {
      const observers = new Map<string, IntersectionObserver>();
      const watched = new WeakMap<Element, Watched>();
      const timers = new Map<Element, ReturnType<typeof setTimeout>>();

      const cancelTimer = (el: Element) => {
        const timer = timers.get(el);
        if (timer === undefined) return;
        clearTimeout(timer);
        timers.delete(el);
      };

      const done = (el: Element) => {
        const state = watched.get(el);
        if (!state) return;
        cancelTimer(el);
        if (state.once) {
          state.observer.unobserve(el);
          watched.delete(el);
        }
        fire(el);
      };

      const onIntersect = (entries: IntersectionObserverEntry[]) => {
        for (const entry of entries) {
          const { target, isIntersecting } = entry;
          const state = watched.get(target);
          if (!state) continue;
          if (!state.adjusted) {
            state.adjusted = true;
            const needed = neededRatio(entry, state.threshold);
            if (needed < state.threshold) {
              state.observer.unobserve(target);
              state.observer = getObserver(needed, state.rootMargin);
              state.observer.observe(target);
              continue;
            }
          }
          if (!isIntersecting) {
            cancelTimer(target);
            continue;
          }
          if (state.minVisibleMs <= 0) {
            done(target);
          } else if (!timers.has(target)) {
            timers.set(
              target,
              setTimeout(() => {
                done(target);
              }, state.minVisibleMs),
            );
          }
        }
      };

      /** threshold·rootMargin 조합마다 IntersectionObserver 하나를 공유한다. */
      const getObserver = (threshold: number, rootMargin: string) => {
        const id = `${String(threshold)}|${rootMargin}`;
        let observer = observers.get(id);
        if (!observer) {
          observer = new IntersectionObserver(onIntersect, { threshold, rootMargin });
          observers.set(id, observer);
        }
        return observer;
      };

      return {
        attach(el, options) {
          const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
          const rootMargin = options?.rootMargin ?? DEFAULT_ROOT_MARGIN;
          const observer = getObserver(threshold, rootMargin);
          watched.set(el, {
            observer,
            threshold,
            rootMargin,
            minVisibleMs: options?.minVisibleMs ?? 0,
            once: options?.once ?? true,
            adjusted: false,
          });
          observer.observe(el);
        },
        detach(el) {
          const state = watched.get(el);
          if (!state) return;
          cancelTimer(el);
          state.observer.unobserve(el);
          watched.delete(el);
        },
        destroy() {
          for (const timer of timers.values()) clearTimeout(timer);
          timers.clear();
          for (const observer of observers.values()) observer.disconnect();
          observers.clear();
        },
      };
    },
  });
}
