// ============================================================
// Database connection pool
// ============================================================
const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'restaurant_db',
  user: process.env.DB_USER || 'appuser',
  password: process.env.DB_PASSWORD || 'apppassword',
  max: parseInt(process.env.DB_POOL_MAX || '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  logger.debug('PostgreSQL: New client connected');
});

pool.on('error', (err) => {
  logger.error('PostgreSQL pool error:', err);
});

// Helper: chạy query với parameterized values
const query = (text, params) => {
  const start = Date.now();
  return pool.query(text, params).then((res) => {
    const duration = Date.now() - start;
    logger.debug('Executed query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  });
};

// Helper: lấy client từ pool (dùng cho transaction)
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
