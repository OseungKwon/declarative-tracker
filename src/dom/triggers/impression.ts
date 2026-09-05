import { defineTrigger } from '../trigger';
import { createObserverPool } from './observer-pool';

const DEFAULT_THRESHOLD = 0.5;
const DEFAULT_ROOT_MARGIN = '0px';

interface Watched {
  observer: IntersectionObserver;
  threshold: number;
  rootMargin: string;
  minVisibleMs: number;
  once: boolean;
  adjusted: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

/** 뷰포트보다 큰 요소는 threshold에 닿을 수 없으므로 "뷰포트의 threshold만큼 채움"으로 바꿔 계산한다. */
function neededRatio(entry: IntersectionObserverEntry, threshold: number): number {
  const rootHeight = entry.rootBounds?.height;
  const height = entry.boundingClientRect.height;
  if (!rootHeight || height <= rootHeight) return threshold;
  return Math.max(0.01, Math.round(((rootHeight * threshold) / height) * 100) / 100);
}

/** 요소에 걸린 minVisibleMs 타이머를 취소한다. */
function clearTimer(state: Watched): void {
  if (state.timer === undefined) return;
  clearTimeout(state.timer);
  state.timer = undefined;
}

/** 요소가 뷰포트에 threshold 이상, minVisibleMs 이상 보이면 이벤트를 보낸다. once가 false면 다시 보일 때마다 보낸다. */
export function impressionTrigger() {
  return defineTrigger({
    name: 'impression',
    setup({ fire }) {
      const watched = new Map<Element, Watched>();
      const pool = createObserverPool((entries) => {
        for (const entry of entries) handle(entry);
      });

      const finish = (el: Element, state: Watched) => {
        clearTimer(state);
        if (state.once) {
          state.observer.unobserve(el);
          watched.delete(el);
        }
        fire(el);
      };

      /** 뷰포트보다 큰 요소면 닿을 수 있는 threshold의 observer로 옮긴다. 옮겼으면 true. */
      const reobserveIfTall = (entry: IntersectionObserverEntry, state: Watched) => {
        const needed = neededRatio(entry, state.threshold);
        if (needed >= state.threshold) return false;
        state.observer.unobserve(entry.target);
        state.observer = pool.get(needed, state.rootMargin);
        state.observer.observe(entry.target);
        return true;
      };

      const handle = (entry: IntersectionObserverEntry) => {
        const el = entry.target;
        const state = watched.get(el);
        if (!state) return;
        if (!state.adjusted) {
          state.adjusted = true;
          if (reobserveIfTall(entry, state)) return;
        }
        if (!entry.isIntersecting) {
          clearTimer(state);
          return;
        }
        if (state.minVisibleMs <= 0) {
          finish(el, state);
        } else {
          state.timer ??= setTimeout(() => {
            finish(el, state);
          }, state.minVisibleMs);
        }
      };

      return {
        attach(el, options) {
          const threshold = options?.threshold ?? DEFAULT_THRESHOLD;
          const rootMargin = options?.rootMargin ?? DEFAULT_ROOT_MARGIN;
          const observer = pool.get(threshold, rootMargin);
          watched.set(el, {
            observer,
            threshold,
            rootMargin,
            minVisibleMs: options?.minVisibleMs ?? 0,
            once: options?.once ?? true,
            adjusted: false,
            timer: undefined,
          });
          observer.observe(el);
        },
        detach(el) {
          const state = watched.get(el);
          if (!state) return;
          clearTimer(state);
          state.observer.unobserve(el);
          watched.delete(el);
        },
        destroy() {
          for (const state of watched.values()) clearTimer(state);
          watched.clear();
          pool.disconnectAll();
        },
      };
    },
  });
}
