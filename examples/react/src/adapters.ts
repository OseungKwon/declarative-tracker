import type { Adapter } from 'declarative-tracker';

interface Ga4Payload {
  name: string;
  params?: Record<string, unknown>;
}

interface AppsFlyerPayload {
  eventName: string;
  eventValue?: Record<string, unknown>;
}

const lines: string[] = [];
const listeners = new Set<() => void>();

/** 로그 패널이 구독하는 간단한 스토어. 실제 앱에선 gtag / AF.logEvent 호출이 들어갈 자리다. */
function print(adapter: string, line: string) {
  lines.unshift(`[${adapter}] ${line}`);
  for (const listener of listeners) listener();
}

export const logStore = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => lines.join('\n'),
};

export const ga4: Adapter<Ga4Payload> = {
  name: 'ga4',
  send(payload, event) {
    print('ga4', `${payload.name} ${JSON.stringify(payload.params ?? {})}  ← ${event.trigger}`);
  },
};

export const appsflyer: Adapter<AppsFlyerPayload> = {
  name: 'appsflyer',
  send(payload) {
    print('appsflyer', `${payload.eventName} ${JSON.stringify(payload.eventValue ?? {})}`);
  },
};
