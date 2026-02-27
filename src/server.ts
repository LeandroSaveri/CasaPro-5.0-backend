import app from './app';
import logger from './config/logger';
import { closePool } from './config/database';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`, {
    timestamp: new Date().toISOString()
  });
});

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(async (err?: Error) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err.message });
    } else {
      logger.info('HTTP server closed successfully');
    }

    try {
      await closePool();
      logger.info('Database connections closed successfully');
      process.exit(0);
    } catch (shutdownError) {
      const errorMessage = shutdownError instanceof Error ? shutdownError.message : 'Unknown error';
      logger.error('Error during database shutdown', { error: errorMessage });
      process.exit(1);
    }
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  logger.error('Unhandled Rejection', { 
    reason: reason instanceof Error ? reason.message : String(reason),
    promise: String(promise)
  });
  process.exit(1);
});
