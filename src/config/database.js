import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// Support both DATABASE_URL and individual vars
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'salon_booking',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
      }
);

// Verify connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('[DB] ❌ Connection error:', err.message);
    console.error('[DB] Check your DATABASE_URL or DB_* env variables.');
  } else {
    console.log('[DB] ✅ PostgreSQL connected successfully.');
    release();
  }
});

export default pool;
