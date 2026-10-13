// ============================================================
// JWT Authentication Middleware
// ============================================================
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'restaurant_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

// Tạo JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Middleware: Kiểm tra token
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Chưa đăng nhập. Vui lòng cung cấp token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn('Invalid token:', { error: err.message, ip: req.ip });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn. Vui lòng đăng nhập lại.' });
    }
    return res.status(401).json({ success: false, message: 'Token không hợp lệ.' });
  }
};

// Middleware: Kiểm tra quyền
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Chưa xác thực.' });
    }
    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt:', { user: req.user.username, required: roles, path: req.path });
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
};

module.exports = { authenticate, authorize, generateToken };
