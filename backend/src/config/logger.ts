import pino from "pino";
import {createGcpLoggingPinoConfig} from "@google-cloud/pino-logging-gcp-config";

const isDevelopment = process.env.NODE_ENV !== "production";

const logger = isDevelopment
  ? pino({
    level: process.env.LOG_LEVEL || "trace",
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    },
    formatters: {
      level: (label) => {
        return {level: label};
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: "zerofy-emulator",
      version: "1.0.0",
    },
  })
  : pino(
    createGcpLoggingPinoConfig(
      {
        serviceContext: {
          service: "zerofy-emulator",
          version: "1.0.0",
        },
      },
      {
        level: process.env.LOG_LEVEL || "info",
      }
    ) as pino.LoggerOptions
  );

/**
 * Create child logger for specific modules
 */
export const createModuleLogger = (module: string) => {
  return logger.child({module});
};

export {logger};
