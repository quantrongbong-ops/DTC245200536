// ============================================================
// Category Controller
// ============================================================
const { query } = require('../config/database');
const logger = require('../utils/logger');

// GET /api/v1/categories
const getAll = async (req, res) => {
  try {
    const result = await query(`
      SELECT c.*, COUNT(m.id) AS item_count
      FROM categories c
      LEFT JOIN menu_items m ON m.category_id = c.id AND m.is_available = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get categories error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// GET /api/v1/categories/:id
const getById = async (req, res) => {
  try {
    const result = await query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Get category error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/categories
const create = async (req, res) => {
  try {
    const { name, description, sort_order = 0 } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Tên danh mục không được trống.' });

    const result = await query(
      'INSERT INTO categories (name, description, sort_order) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description || null, sort_order]
    );
    logger.info('Category created:', { name, by: req.user?.username });
    res.status(201).json({ success: true, message: 'Tạo danh mục thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
    logger.error('Create category error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PUT /api/v1/categories/:id
const update = async (req, res) => {
  try {
    const { name, description, sort_order, is_active } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Tên danh mục không được trống.' });

    const result = await query(
      'UPDATE categories SET name=$1, description=$2, sort_order=$3, is_active=$4 WHERE id=$5 RETURNING *',
      [name.trim(), description || null, sort_order ?? 0, is_active ?? true, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    res.json({ success: true, message: 'Cập nhật danh mục thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
    logger.error('Update category error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// DELETE /api/v1/categories/:id
const remove = async (req, res) => {
  try {
    // Kiểm tra còn món ăn không
    const itemCheck = await query('SELECT COUNT(*) AS cnt FROM menu_items WHERE category_id = $1', [req.params.id]);
    if (parseInt(itemCheck.rows[0].cnt) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Không thể xóa danh mục vì vẫn còn món ăn. Hãy chuyển món ăn sang danh mục khác trước.',
      });
    }

    const result = await query('DELETE FROM categories WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục.' });
    res.json({ success: true, message: 'Xóa danh mục thành công.' });
  } catch (err) {
    logger.error('Delete category error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { getAll, getById, create, update, remove };
