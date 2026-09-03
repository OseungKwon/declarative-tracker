import { defineTrigger } from '../trigger';

const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_ROOT_MARGIN = '0px';

interface Watched {
  observer: IntersectionObserver;
  minVisibleMs: number;
}

/** 요소가 뷰포트에 threshold 이상, minVisibleMs 이상 보이면 한 번 발화한다. */
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
        state.observer.unobserve(el);
        watched.delete(el);
        fire(el);
      };

      const onIntersect = (entries: IntersectionObserverEntry[]) => {
        for (const { target, isIntersecting } of entries) {
          const state = watched.get(target);
          if (!state) continue;
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
          const observer = getObserver(
            options?.threshold ?? DEFAULT_THRESHOLD,
            options?.rootMargin ?? DEFAULT_ROOT_MARGIN,
          );
          watched.set(el, { observer, minVisibleMs: options?.minVisibleMs ?? 0 });
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
