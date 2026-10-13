// ============================================================
// Biến môi trường cho test (chạy trước khi load app)
// Test chạy với database PostgreSQL riêng (docker, port 5433)
// ============================================================
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-change-me';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5433';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'restaurant_db';
process.env.DB_USER = process.env.TEST_DB_USER || 'appuser';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'apppassword';
process.env.LOG_LEVEL = 'error';
