// ============================================================
// Auth Controller
// ============================================================
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { generateToken } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

// POST /api/v1/auth/login
// Hỗ trợ đăng nhập bằng username HOẶC email
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const identifier = String(username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    const result = await query(
      'SELECT id, username, password, full_name, role, email, is_active FROM users WHERE username = $1 OR email = $1',
      [identifier]
    );

    const user = result.rows[0];

    if (!user) {
      logger.warn('Login attempt with invalid username:', { username, ip: req.ip });
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn('Login attempt with wrong password:', { username, ip: req.ip });
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const token = generateToken({
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    });

    logger.info('User logged in successfully:', { username: user.username, role: user.role });

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          full_name: user.full_name,
          role: user.role,
          email: user.email,
        },
      },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi đăng nhập.' });
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, full_name, role, email, phone, is_active, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('GetMe error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const result = await query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
    }

    const hashed = await bcrypt.hash(new_password, 12);
    await query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

    logger.info('Password changed:', { userId: req.user.id });
    res.json({ success: true, message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    logger.error('Change password error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { login, getMe, changePassword };
