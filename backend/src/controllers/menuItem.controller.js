// ============================================================
// Menu Item Controller
// ============================================================
const { query } = require('../config/database');
const { parsePositiveInt } = require('../utils/query');
const { parsePriceInput, MAX_NAME_LENGTH } = require('../utils/validation');
const logger = require('../utils/logger');

// GET /api/v1/menu-items?category_id=&search=&page=1&limit=20&available=true
const getAll = async (req, res) => {
  try {
    const page  = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.category_id) {
      params.push(req.query.category_id);
      conditions.push(`m.category_id = $${params.length}`);
    }
    if (req.query.available === 'true') {
      conditions.push(`m.is_available = TRUE`);
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      conditions.push(`m.name ILIKE $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(
      `SELECT COUNT(*) AS total FROM menu_items m ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    params.push(limit, offset);
    const result = await query(`
      SELECT m.*, c.name AS category_name
      FROM menu_items m
      JOIN categories c ON m.category_id = c.id
      ${where}
      ORDER BY m.sort_order, m.name
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('Get menu items error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// GET /api/v1/menu-items/:id
const getById = async (req, res) => {
  try {
    const result = await query(`
      SELECT m.*, c.name AS category_name FROM menu_items m
      JOIN categories c ON m.category_id = c.id WHERE m.id = $1
    `, [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/menu-items
const create = async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_available = true, sort_order = 0 } = req.body;

    if (!category_id || !name?.trim()) {
      return res.status(400).json({ success: false, message: 'Danh mục và tên món ăn là bắt buộc.' });
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return res.status(400).json({ success: false, message: `Tên món ăn tối đa ${MAX_NAME_LENGTH} ký tự.` });
    }
    const priceCheck = parsePriceInput(price);
    if (priceCheck.error) {
      return res.status(400).json({ success: false, message: priceCheck.error });
    }

    const result = await query(
      `INSERT INTO menu_items (category_id, name, description, price, image_url, is_available, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [category_id, name.trim(), description || null, priceCheck.value, image_url || null, is_available, sort_order]
    );
    logger.info('Menu item created:', { name, by: req.user?.username });
    res.status(201).json({ success: true, message: 'Tạo món ăn thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
    logger.error('Create menu item error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PUT /api/v1/menu-items/:id
const update = async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_available, sort_order } = req.body;

    // PUT = thay thế toàn bộ tài nguyên → bắt buộc các cột NOT NULL.
    // Trước đây nhánh kiểm tra dùng `price !== undefined`, nên khi client
    // KHÔNG gửi price thì parseFloat(undefined) = NaN, PostgreSQL chấp nhận
    // NaN cho kiểu NUMERIC và CHECK (price >= 0) vẫn đúng với NaN
    // → giá món ăn bị lưu thành NaN. Tương tự, thiếu name/category_id sẽ
    // gây lỗi NOT NULL (23502) và trả HTTP 500 thay vì 400.
    if (!category_id) {
      return res.status(400).json({ success: false, message: 'Danh mục là bắt buộc.' });
    }
    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Tên món ăn không được trống.' });
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return res.status(400).json({ success: false, message: `Tên món ăn tối đa ${MAX_NAME_LENGTH} ký tự.` });
    }
    const priceCheck = parsePriceInput(price);
    if (priceCheck.error) {
      return res.status(400).json({ success: false, message: priceCheck.error });
    }

    const result = await query(
      `UPDATE menu_items SET category_id=$1, name=$2, description=$3, price=$4, image_url=$5, is_available=$6, sort_order=$7
       WHERE id=$8 RETURNING *`,
      [category_id, name.trim(), description || null, priceCheck.value, image_url || null, is_available ?? true, sort_order ?? 0, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
    res.json({ success: true, message: 'Cập nhật món ăn thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ success: false, message: 'Danh mục không tồn tại.' });
    logger.error('Update menu item error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PATCH /api/v1/menu-items/:id/toggle
const toggleAvailability = async (req, res) => {
  try {
    const result = await query(
      'UPDATE menu_items SET is_available = NOT is_available WHERE id = $1 RETURNING id, name, is_available',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Toggle menu item error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// DELETE /api/v1/menu-items/:id
const remove = async (req, res) => {
  try {
    const result = await query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy món ăn.' });
    res.json({ success: true, message: 'Xóa món ăn thành công.' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ success: false, message: 'Không thể xóa món ăn đã có trong đơn hàng.' });
    }
    logger.error('Delete menu item error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { getAll, getById, create, update, remove, toggleAvailability };
