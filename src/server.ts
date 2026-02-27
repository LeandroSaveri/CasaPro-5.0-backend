import app from './app';
import { env } from './config/env';
import logger from './config/logger';
import { closePool, query } from './config/database';
import http from 'http';

const PORT = env.PORT;

async function connectDatabase(): Promise<void> {
  try {
    await query('SELECT NOW()');
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

async function bootstrap(): Promise<void> {
  try {
    logger.info('Starting server bootstrap...', {
      environment: env.NODE_ENV,
      port: PORT
    });

    await connectDatabase();

    const server: http.Server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`, {
        environment: env.NODE_ENV,
        port: PORT,
        timestamp: new Date().toISOString()
      });
    });

    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received. Starting graceful shutdown...`, {
        signal,
        timestamp: new Date().toISOString()
      });

      server.close(async (err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err });
        } else {
          logger.info('HTTP server closed successfully');
        }

        try {
          await closePool();
          logger.info('Database connections closed successfully');
          process.exit(0);
        } catch (shutdownError) {
          logger.error('Error during database shutdown', { error: shutdownError });
          process.exit(1);
        }
      });

      setTimeout(() => {
        logger.error('Forced shutdown due to timeout', {
          timeoutMs: 30000,
          timestamp: new Date().toISOString()
        });
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
      logger.error('Unhandled Rejection', {
        reason,
        promise: String(promise),
        timestamp: new Date().toISOString()
      });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Bootstrap failed. Server not started.', {
      error,
      timestamp: new Date().toISOString()
    });
    process.exit(1);
  }
}

bootstrap();
