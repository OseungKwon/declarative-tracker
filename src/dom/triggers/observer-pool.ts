export interface ObserverPool {
  get(threshold: number, rootMargin: string): IntersectionObserver;
  disconnectAll(): void;
}

/** threshold·rootMargin 조합마다 IntersectionObserver 하나를 만들어 공유한다. */
export function createObserverPool(callback: IntersectionObserverCallback): ObserverPool {
  const observers = new Map<string, IntersectionObserver>();
  return {
    get(threshold, rootMargin) {
      const id = `${String(threshold)}|${rootMargin}`;
      let observer = observers.get(id);
      if (!observer) {
        observer = new IntersectionObserver(callback, { threshold, rootMargin });
        observers.set(id, observer);
      }
      return observer;
    },
    disconnectAll() {
      for (const observer of observers.values()) observer.disconnect();
      observers.clear();
    },
  };
}
