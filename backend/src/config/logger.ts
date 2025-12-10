import pino from 'pino';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

const logLevel = 'trace';
const isDev = process.env.NODE_ENV !== 'production';

export const logger = isDev
  ? pino({
      level: logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard'
        }
      }
    })
  : pino(
      createGcpLoggingPinoConfig(
        {
          serviceContext: {
            service: 'zerofy-emulatior',
            version: '1.0.0'
          }
        },
        {
          level: logLevel
        }
      ) as pino.LoggerOptions<string, boolean>
    );
