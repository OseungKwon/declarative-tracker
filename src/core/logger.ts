const PREFIX = '%c[declarative-tracker]%c';
const PREFIX_STYLE = 'color:#7c3aed;font-weight:600';
const RESET_STYLE = '';

export interface Logger {
  warn(message: string, ...rest: unknown[]): void;
  error(message: string, ...rest: unknown[]): void;
}

export type LoggerOption = Logger | false;

const consoleLogger: Logger = {
  warn(message, ...rest) {
    console.warn(`${PREFIX} ${message}`, PREFIX_STYLE, RESET_STYLE, ...rest);
  },
  error(message, ...rest) {
    console.error(`${PREFIX} ${message}`, PREFIX_STYLE, RESET_STYLE, ...rest);
  },
};

const silentLogger: Logger = {
  warn: () => undefined,
  error: () => undefined,
};

/** 로거를 만든다. warn은 debug일 때만 base로 넘기고, base가 false면 아무것도 찍지 않는다. 기본 base는 접두가 붙은 콘솔이다. */
export function createLogger(debug: boolean, base: LoggerOption = consoleLogger): Logger {
  if (base === false) return silentLogger;
  return {
    warn(message, ...rest) {
      if (debug) base.warn(message, ...rest);
    },
    error(message, ...rest) {
      base.error(message, ...rest);
    },
  };
}
