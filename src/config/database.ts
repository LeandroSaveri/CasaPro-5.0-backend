import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from './env';
import logger from './logger';

interface DatabaseConfig {
  connectionString: string;
  ssl: boolean | { rejectUnauthorized: boolean };
  max: number;
  idleTimeoutMillis: 30000;
  connectionTimeoutMillis: 2000;
}

const isProduction = env.NODE_ENV === 'production';

const poolConfig: DatabaseConfig = {
  connectionString: env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('New client connected to PostgreSQL');
});

pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle PostgreSQL client', { error: err.message });
  process.exit(-1);
});

pool.on('remove', () => {
  logger.info('PostgreSQL client removed from pool');
});

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text: text.substring(0, 100), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error', { text: text.substring(0, 100), error });
    throw error;
  }
}

export async function getClient(): Promise<PoolClient> {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  
  client.query = async (...args: any[]): Promise<any> => {
    const start = Date.now();
    try {
      const result = await originalQuery(...args);
      const duration = Date.now() - start;
      logger.debug('Client query executed', { duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Client query error', { error });
      throw error;
    }
  };

  return client;
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool(): Promise<void> {
  logger.info('Closing PostgreSQL pool...');
  await pool.end();
  logger.info('PostgreSQL pool closed');
}

export { pool };
export default pool;
