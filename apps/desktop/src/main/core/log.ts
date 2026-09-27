import type { Logger } from '@guide/sdk';

export function createLogger(scope: string): Logger {
  const prefix = `[${scope}]`;
  return {
    info: (message, ...args) => console.log(prefix, message, ...args),
    warn: (message, ...args) => console.warn(prefix, message, ...args),
    error: (message, ...args) => console.error(prefix, message, ...args),
  };
}
