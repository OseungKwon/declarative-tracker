import type { Adapter } from 'declarative-tracker';

interface Ga4Payload {
  name: string;
  params?: Record<string, unknown>;
}

interface AppsFlyerPayload {
  eventName: string;
  eventValue?: Record<string, unknown>;
}

const log = document.getElementById('log') as HTMLPreElement;

/** 화면 하단 패널에 한 줄 남긴다. 실제 앱에선 gtag / AF.logEvent 호출이 들어갈 자리다. */
function print(adapter: string, line: string) {
  log.textContent = `[${adapter}] ${line}\n${log.textContent ?? ''}`;
}

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
