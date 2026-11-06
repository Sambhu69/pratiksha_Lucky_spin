import { Pool, PoolClient, PoolConfig } from 'pg';
import { env } from './env.js';

/**
 * PostgreSQL Connection Pool Configuration
 * Uses discrete connection parameters so special characters in passwords (e.g. @, !)
 * never break connection establishment.
 *
 * CRITICAL RELIABILITY FIX:
 * Sets 'options: -c timezone=Asia/Kathmandu' directly in Pool options.
 * This instructs PostgreSQL to set the session timezone during connection handshake,
 * preventing race conditions where the first query executes before an asynchronous
 * 'SET TIME ZONE' query finishes.
 */
const poolConfig: PoolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 20, // Maximum 20 simultaneous connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c timezone=Asia/Kathmandu',
};

// Fallback to DATABASE_URL only if discrete DB_HOST is not provided
if (!env.DB_HOST && env.DATABASE_URL) {
  delete poolConfig.host;
  delete poolConfig.port;
  delete poolConfig.user;
  delete poolConfig.password;
  delete poolConfig.database;
  poolConfig.connectionString = env.DATABASE_URL;
}

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Error]: Unexpected client error:', err);
});

/**
 * Execute an ACID Database Transaction safely.
 * Handles BEGIN, callback execution, COMMIT, and automatic ROLLBACK on failure.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
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
