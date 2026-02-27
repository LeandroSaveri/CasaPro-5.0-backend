import winston from 'winston';
import { env } from './env';

const { combine, timestamp, json, errors, printf, colorize } = winston.format;

const isDevelopment = env.NODE_ENV === 'development';

const devFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  if (stack) {
    msg += `\n${stack}`;
  }
  return msg;
});

const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  defaultMeta: { service: 'casapro-backend' },
  transports: [
    new winston.transports.Console({
      format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        isDevelopment ? combine(colorize(), devFormat) : json()
      )
    })
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: combine(timestamp(), json())
    })
  ],
  rejectionHandlers: [
    new winston.transports.Console({
      format: combine(timestamp(), json())
    })
  ]
});

export const logStream = {
  write: (message: string): void => {
    logger.info(message.trim());
  }
};

export default logger;
