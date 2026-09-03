const PREFIX = '%c[declarative-tracker]%c';
const PREFIX_STYLE = 'color:#7c3aed;font-weight:600';
const RESET_STYLE = '';

export interface Logger {
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
}

/** 콘솔 로거를 만든다. warn은 debug일 때만 출력한다. */
export function createLogger(debug: boolean): Logger {
  return {
    warn(message, ...rest) {
      if (!debug) return;
      console.warn(`${PREFIX} ${message}`, PREFIX_STYLE, RESET_STYLE, ...rest);
    },
    error(message, ...rest) {
      console.error(`${PREFIX} ${message}`, PREFIX_STYLE, RESET_STYLE, ...rest);
    },
  };
}
