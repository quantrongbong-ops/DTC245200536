// ============================================================
// User Controller (Admin only)
// ============================================================
const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const logger = require('../utils/logger');

// Regex kiểm tra định dạng email (không cần xác thực OTP, chỉ kiểm tra format)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email) => {
  if (email === undefined || email === null || email === '') return { value: null };
  const trimmed = String(email).trim().toLowerCase();
  if (!EMAIL_REGEX.test(trimmed)) {
    return { error: 'Email không đúng định dạng (ví dụ: ten@example.com).' };
  }
  return { value: trimmed };
};

// GET /api/v1/users
const getAll = async (req, res) => {
  try {
    const result = await query(
      'SELECT id, username, full_name, role, email, phone, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get users error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/users
const create = async (req, res) => {
  try {
    const { username, password, full_name, role = 'staff', email, phone } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ success: false, message: 'Username, password và họ tên là bắt buộc.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 6 ký tự.' });
    }
    const validRoles = ['admin', 'staff', 'cashier'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
    }

    // Kiểm tra định dạng email nếu có cung cấp
    const emailCheck = validateEmail(email);
    if (emailCheck.error) {
      return res.status(400).json({ success: false, message: emailCheck.error });
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO users (username, password, full_name, role, email, phone) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, username, full_name, role, email',
      [username.trim().toLowerCase(), hashed, full_name.trim(), role, emailCheck.value, phone || null]
    );
    logger.info('User created:', { username, role, by: req.user?.username });
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Username hoặc email đã tồn tại.' });
    logger.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PUT /api/v1/users/:id
const update = async (req, res) => {
  try {
    const { full_name, role, email, phone, is_active } = req.body;
    if (role !== undefined) {
      const validRoles = ['admin', 'staff', 'cashier'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Vai trò không hợp lệ.' });
      }
    }
    const emailCheck = validateEmail(email);
    if (emailCheck.error) {
      return res.status(400).json({ success: false, message: emailCheck.error });
    }
    const result = await query(
      'UPDATE users SET full_name=$1, role=$2, email=$3, phone=$4, is_active=$5 WHERE id=$6 RETURNING id, username, full_name, role, email, is_active',
      [full_name, role, emailCheck.value, phone || null, is_active ?? true, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Email đã tồn tại.' });
    logger.error('Update user error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// DELETE /api/v1/users/:id
const remove = async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(409).json({ success: false, message: 'Không thể xóa tài khoản đang đăng nhập.' });
    }
    const result = await query('DELETE FROM users WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });
    res.json({ success: true, message: 'Xóa người dùng thành công.' });
  } catch (err) {
    logger.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { getAll, create, update, remove };
