import { useCallback, useContext } from 'react';

import type { FireArgs, Tracker } from '../core/tracker';
import type { EventKeys, EventMap, EventParams } from '../core/types';
import { TrackerContext } from './provider';
import { type TrackProps, type TrackPropsOptions, useTrackProps } from './track-props';

export type FireKey<M extends EventMap, K extends EventKeys<M>> = (
  ...args: FireArgs<EventParams<M, K>>
) => void;

/** 가장 가까운 TrackingProvider의 tracker를 돌려준다. 없으면 throw한다. */
export function useTracker<M extends EventMap = EventMap>(): Tracker<M> {
  const tracker = useContext(TrackerContext);
  if (!tracker) {
    throw new Error('[declarative-tracker] useTracker must be used inside <TrackingProvider>');
  }
  return tracker as Tracker<M>;
}

/** tracker.fire를 돌려준다. 키를 주면 그 키에 묶인 함수를 돌려준다. */
export function useFire<M extends EventMap = EventMap>(): Tracker<M>['fire'];
export function useFire<M extends EventMap, K extends EventKeys<M>>(key: K): FireKey<M, K>;
export function useFire<M extends EventMap, K extends EventKeys<M>>(key?: K) {
  const tracker = useTracker<M>();
  const fireKey = useCallback(
    (...args: FireArgs<EventParams<M, K>>) => {
      if (key !== undefined) tracker.fire(key, ...args);
    },
    [tracker, key],
  );
  return key === undefined ? tracker.fire : fireKey;
}

export interface TrackingHooks<M extends EventMap> {
  useTracker: () => Tracker<M>;
  useFire: {
    (): Tracker<M>['fire'];
    <K extends EventKeys<M>>(key: K): FireKey<M, K>;
  };
  useTrackProps: <K extends EventKeys<M>>(
    key: K,
    params?: EventParams<M, K>,
    options?: TrackPropsOptions,
  ) => TrackProps;
}

/** 이벤트 맵 타입을 고정한 훅을 만든다. 호출할 때마다 제네릭을 쓰지 않아도 된다. */
export function createTrackingHooks<M extends EventMap>(): TrackingHooks<M> {
  return {
    useTracker: () => useTracker<M>(),
    useFire: (<K extends EventKeys<M>>(key?: K) =>
      key === undefined ? useFire<M>() : useFire<M, K>(key)) as TrackingHooks<M>['useFire'],
    useTrackProps: (key, params, options) => useTrackProps<M, typeof key>(key, params, options),
  };
}
