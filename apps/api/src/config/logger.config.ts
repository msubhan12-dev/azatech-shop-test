import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';

export function createWinstonLogger(): WinstonModuleOptions {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    transports: [
      new winston.transports.Console({
        format: isProduction
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.timestamp({ format: 'HH:mm:ss' }),
              winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                const ctx = context ? `[${context}]` : '';
                const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
              }),
            ),
      }),
    ],
  };
}
