// @ts-types="npm:@types/pg@8.10.9"
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DatabaseConfig = {
  connectionString: process.env.DATABASE_URL ?? 'postgresql://hems_user:hems_password@localhost:5432/hems_emulator',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create a singleton pool instance
export const pool = new Pool(DatabaseConfig);

// Helper function to execute queries
export const query = async (text: string, params?: unknown[]) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

// Helper function for transactions
export const transaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
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
};

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    await query('SELECT 1');
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Self-test when run directly
if (import.meta.main) {
  console.log('Testing database connection...');
  await testConnection();
  await pool.end();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
}); 