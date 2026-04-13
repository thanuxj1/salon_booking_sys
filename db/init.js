import 'dotenv/config';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

try {
  await pool.query(schema);
  console.log('✅ Database schema initialized successfully.');
} catch (err) {
  console.error('❌ Error initializing schema:', err.message);
} finally {
  await pool.end();
}
