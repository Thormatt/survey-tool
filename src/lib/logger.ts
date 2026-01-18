/**
 * Logger utility - simple wrapper that can be swapped for Pino/Winston later
 */

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogContext {
  [key: string]: unknown;
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` ${JSON.stringify(context)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

export const logger = {
  error: (message: string, error?: unknown, context?: LogContext) => {
    const errorInfo = error instanceof Error
      ? { errorMessage: error.message, stack: error.stack }
      : error !== undefined
        ? { error }
        : undefined;
    console.error(formatMessage("error", message, { ...context, ...errorInfo }));
  },

  warn: (message: string, context?: LogContext) => {
    console.warn(formatMessage("warn", message, context));
  },

  info: (message: string, context?: LogContext) => {
    console.info(formatMessage("info", message, context));
  },

  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatMessage("debug", message, context));
    }
  },
};
