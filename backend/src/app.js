// ============================================================
// Express App configuration
// ============================================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { metricsMiddleware, metricsHandler } = require('./utils/metrics');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const categoryRoutes = require('./routes/category.routes');
const menuItemRoutes = require('./routes/menuItem.routes');
const tableRoutes = require('./routes/table.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

// ============================================================
// Security Middleware
// ============================================================
app.use(helmet({
  contentSecurityPolicy: false, // Handled by Nginx
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.' },
});
app.use(limiter);

// ============================================================
// Standard Middleware
// ============================================================
app.use(compression());

// CORS: mặc định mở cho môi trường dev, giới hạn origin khi cấu hình CORS_ORIGIN
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : '*';
app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: Array.isArray(corsOrigins), // credentials chỉ hợp lệ với origin cụ thể, không dùng với '*'
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// HTTP request logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
  skip: (req) => req.path === '/metrics' || req.path === '/health',
}));

// Prometheus metrics collection
app.use(metricsMiddleware);

// ============================================================
// Health Check
// ============================================================
app.get('/health', async (req, res) => {
  const { pool } = require('./config/database');
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'restaurant-backend',
      version: '1.0.0',
      database: 'connected',
    });
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: err.message,
    });
  }
});

// ============================================================
// Metrics endpoint
// ============================================================
app.get('/metrics', metricsHandler);

// ============================================================
// API Routes
// ============================================================
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/categories`, categoryRoutes);
app.use(`${API_PREFIX}/menu-items`, menuItemRoutes);
app.use(`${API_PREFIX}/tables`, tableRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/payments`, paymentRoutes);
app.use(`${API_PREFIX}/dashboard`, dashboardRoutes);

// ============================================================
// 404 Handler
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint không tồn tại: ${req.method} ${req.path}`,
  });
});

// ============================================================
// Global Error Handler
// ============================================================
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack, path: req.path });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'JSON không hợp lệ' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Lỗi server nội bộ' : err.message,
  });
});

module.exports = app;
