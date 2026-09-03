import { createTracker } from 'declarative-tracker';
import { createTrackingHooks } from 'declarative-tracker/react';

import { appsflyer, ga4 } from './adapters';
import { events } from './events';

export const tracker = createTracker({
  events,
  adapters: [ga4, appsflyer],
  context: { page: 'home' },
  debug: true,
});

// 맵 타입이 고정된 훅. 컴포넌트에서 제네릭 없이 쓴다
export const { useFire, useTrackProps } = createTrackingHooks<typeof events>();
