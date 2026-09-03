import { createContext, type ReactNode, useEffect, useRef } from 'react';

import type { Tracker } from '../core/tracker';
import { mount, type MountOptions } from '../dom/mount';

export const TrackerContext = createContext<Tracker | null>(null);

export interface TrackingProviderProps {
  tracker: Tracker;
  /** false면 DOM 감시를 하지 않는다. fire()만 쓸 때 */
  mount?: boolean;
  mountOptions?: MountOptions;
  children?: ReactNode;
}

/** tracker를 컨텍스트로 내려주고, 마운트되면 DOM 감시를 시작한다. */
export function TrackingProvider({
  tracker,
  mount: shouldMount = true,
  mountOptions,
  children,
}: TrackingProviderProps) {
  const optionsRef = useRef(mountOptions);
  optionsRef.current = mountOptions;

  useEffect(() => {
    if (!shouldMount) return;
    return mount(tracker, optionsRef.current);
  }, [tracker, shouldMount]);

  return <TrackerContext.Provider value={tracker}>{children}</TrackerContext.Provider>;
}
