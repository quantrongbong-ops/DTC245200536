// ============================================================
// Server entry point
// ============================================================
require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const { pool } = require('./config/database');

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully...`);
  try {
    await pool.end();
    logger.info('PostgreSQL pool closed.');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  (err) => { logger.error('Uncaught Exception:', err);  process.exit(1); });
process.on('unhandledRejection', (err) => { logger.error('Unhandled Rejection:', err); process.exit(1); });

// Khởi động server
const startServer = async () => {
  try {
    // Kiểm tra kết nối DB
    await pool.query('SELECT 1');
    logger.info('Database connection established');

    app.listen(PORT, HOST, () => {
      logger.info(`Restaurant API server running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://${HOST}:${PORT}/health`);
      logger.info(`Metrics: http://${HOST}:${PORT}/metrics`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
