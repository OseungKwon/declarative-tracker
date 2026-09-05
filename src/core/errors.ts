import type { TrackingEvent } from './types';

export type ErrorPhase = 'setup' | 'resolve' | 'send' | 'flush' | 'teardown';

export interface ErrorInfo {
  phase: ErrorPhase;
  adapter?: string;
  event?: TrackingEvent;
}

export type ErrorHandler = (error: unknown, info: ErrorInfo) => void;

/** run을 실행하고 동기·비동기 에러를 onError로 넘긴다. */
export function guard<T>(run: () => T | Promise<T>, info: ErrorInfo, onError: ErrorHandler): void {
  try {
    const result = run();
    if (result instanceof Promise) {
      result.catch((error: unknown) => {
        onError(error, info);
      });
    }
  } catch (error) {
    onError(error, info);
  }
}
