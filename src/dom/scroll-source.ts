export type ScrollTarget = Window | Element;
export type DepthListener = (depth: number) => void;

interface Source {
  listeners: Set<DepthListener>;
  rafId: number;
  schedule: () => void;
}

const sources = new Map<ScrollTarget, Source>();

/** 스크롤 깊이(0~1). 스크롤할 수 없으면 1이다. */
export function scrollDepthOf(target: ScrollTarget): number {
  const isElement = target instanceof Element;
  const scrollable = isElement
    ? target.scrollHeight - target.clientHeight
    : document.documentElement.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 1;
  const scrollTop = isElement ? target.scrollTop : window.scrollY;
  if (scrollable - scrollTop <= 2) return 1;
  return Math.min(1, Math.max(0, scrollTop / scrollable));
}

/** 같은 스크롤 대상에는 리스너 한 쌍만 붙이고, 프레임당 한 번 깊이를 계산해 알린다. 구독 직후 한 번 알린다. */
export function subscribeScrollDepth(target: ScrollTarget, listener: DepthListener): () => void {
  let source = sources.get(target);
  if (!source) {
    const created: Source = {
      listeners: new Set(),
      rafId: 0,
      schedule: () => {
        if (created.rafId) return;
        created.rafId = requestAnimationFrame(() => {
          created.rafId = 0;
          const depth = scrollDepthOf(target);
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
