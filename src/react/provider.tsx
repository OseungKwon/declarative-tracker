import { createContext, type ReactNode, useEffect, useRef } from 'react';

import type { Tracker } from '../core/tracker';
import { observe, type ObserveOptions } from '../dom/observe';

export const TrackerContext = createContext<Tracker | null>(null);

export interface TrackingProviderProps {
  tracker: Tracker;
  /** false면 DOM 감시를 하지 않는다. fire()만 쓸 때 */
  observe?: boolean;
  observeOptions?: ObserveOptions;
  children?: ReactNode;
}

/** tracker를 컨텍스트로 내려주고, 마운트되면 DOM 감시를 시작한다. */
export function TrackingProvider({
  tracker,
  observe: shouldObserve = true,
  observeOptions,
  children,
}: TrackingProviderProps) {
  const optionsRef = useRef(observeOptions);
  optionsRef.current = observeOptions;

  useEffect(() => {
    if (!shouldObserve) return;
    return observe(tracker, optionsRef.current);
  }, [tracker, shouldObserve]);

  return <TrackerContext.Provider value={tracker}>{children}</TrackerContext.Provider>;
}
