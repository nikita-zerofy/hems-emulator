import pino from 'pino';
import {createGcpLoggingPinoConfig} from '@google-cloud/pino-logging-gcp-config';

const logLevel = 'trace';

export const logger = pino(
  createGcpLoggingPinoConfig(
    {
      serviceContext: {
        service: 'zerofy-emulatior',
        version: '1.0.0',
      },
    },
    {
      level: logLevel,
    }
  ) as pino.LoggerOptions<string, boolean>
);
