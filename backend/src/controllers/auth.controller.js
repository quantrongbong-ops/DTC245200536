// ============================================================
// Auth Controller
// ============================================================
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { generateToken } = require('../middlewares/auth.middleware');
const logger = require('../utils/logger');

// Hash giả dùng để cân bằng thời gian phản hồi khi tài khoản không tồn tại,
// tránh lộ thông tin "tài khoản có tồn tại hay không" qua thời gian (timing attack).
const DUMMY_PASSWORD_HASH = '$2b$12$DdNRYPoJFSdUjnj7wUrVruejG/DG6QX4K1BaBkxDnqlIDgCvoBiCm';

// POST /api/v1/auth/login
// Hỗ trợ đăng nhập bằng username HOẶC email
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const identifier = typeof username === 'string' ? username.trim().toLowerCase() : '';

    // Phải là chuỗi hợp lệ — nếu password là số/object, bcrypt.compare sẽ ném lỗi
    // và trả 500 thay vì 400 như mong đợi.
    if (!identifier || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu.' });
    }

    // Dùng LOWER(username/email) để đăng nhập KHÔNG phân biệt hoa/thường.
    // Trước đây code lower-case đầu vào nhưng so sánh `=` phân biệt hoa/thường,
    // nên bất kỳ tài khoản nào có chữ hoa trong username/email (tạo thủ công,
    // import SQL, chỉnh tay qua pgAdmin...) đều bị khoá đăng nhập vĩnh viễn.
    const result = await query(
      'SELECT id, username, password, full_name, role, email, is_active FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1',
      [identifier]
    );

    const user = result.rows[0];

    // Luôn chạy bcrypt.compare kể cả khi không tìm thấy user để thời gian phản hồi
    // không phụ thuộc vào việc tài khoản có tồn tại hay không (chống user enumeration).
    const isValidPassword = await bcrypt.compare(password, user ? user.password : DUMMY_PASSWORD_HASH);

    if (!user || !isValidPassword) {
      logger.warn('Login attempt failed:', { username: identifier, ip: req.ip });
      return res.status(401).json({ success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa.' });
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
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

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
