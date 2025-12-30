import pino from "pino";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";

const logLevel = "trace";
const isDev = process.env.NODE_ENV !== "production";
const gcpTransport = createGcpLoggingPinoConfig(
  {
    serviceContext: {
      service: "zerofy-emulatior",
      version: "1.0.0",
    },
  },
  {
    level: logLevel,
  }
) as pino.LoggerOptions<string, boolean>;
const transports = isDev
  ? {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
    }
  : gcpTransport;
export const logger = pino(transports);
