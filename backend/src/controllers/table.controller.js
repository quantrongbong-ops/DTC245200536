const { query, getClient } = require('../config/database');
const logger = require('../utils/logger');
const getAll = async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`status = $${params.length}`);
    }
    if (req.query.area) {
      params.push(req.query.area);
      conditions.push(`area = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM dining_tables ${where} ORDER BY table_number`,
      params
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Get tables error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};
const getById = async (req, res) => {
  try {
    const result = await query('SELECT * FROM dining_tables WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn.' });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// GET /api/v1/tables/:id/current-order
const getCurrentOrder = async (req, res) => {
  try {
    const result = await query(`
      SELECT o.*, dt.table_number,
        json_agg(json_build_object(
          'id', oi.id,
          'menu_item_id', oi.menu_item_id,
          'name', mi.name,
          'quantity', oi.quantity,
          'unit_price', oi.unit_price,
          'subtotal', oi.subtotal,
          'status', oi.status,
          'image_url', mi.image_url
        ) ORDER BY oi.created_at) AS items
      FROM orders o
      JOIN dining_tables dt ON o.table_id = dt.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.table_id = $1 AND o.status NOT IN ('completed', 'cancelled')
      GROUP BY o.id, dt.table_number
      ORDER BY o.created_at DESC
      LIMIT 1
    `, [req.params.id]);

    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    logger.error('Get current order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/tables
const create = async (req, res) => {
  try {
    const { table_number, area, capacity } = req.body;
    if (!table_number?.trim()) return res.status(400).json({ success: false, message: 'Số bàn là bắt buộc.' });
    if (!capacity || capacity < 1) return res.status(400).json({ success: false, message: 'Sức chứa phải lớn hơn 0.' });

    const result = await query(
      'INSERT INTO dining_tables (table_number, area, capacity) VALUES ($1, $2, $3) RETURNING *',
      [table_number.trim(), area || 'Tầng 1', parseInt(capacity)]
    );
    res.status(201).json({ success: true, message: 'Tạo bàn thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Số bàn đã tồn tại.' });
    logger.error('Create table error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PUT /api/v1/tables/:id
const update = async (req, res) => {
  try {
    const { table_number, area, capacity, status } = req.body;
    if (!table_number?.trim()) {
      return res.status(400).json({ success: false, message: 'Số bàn là bắt buộc.' });
    }
    if (capacity !== undefined && (!Number.isInteger(parseInt(capacity)) || parseInt(capacity) < 1)) {
      return res.status(400).json({ success: false, message: 'Sức chứa phải lớn hơn 0.' });
    }
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái bàn không hợp lệ.' });
    }

    const result = await query(
      'UPDATE dining_tables SET table_number=$1, area=COALESCE($2, area), capacity=COALESCE($3, capacity), status=COALESCE($4, status) WHERE id=$5 RETURNING *',
      [table_number.trim(), area?.trim() || null, capacity !== undefined && capacity !== null ? parseInt(capacity) : null, status || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn.' });
    res.json({ success: true, message: 'Cập nhật bàn thành công.', data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Số bàn đã tồn tại.' });
    logger.error('Update table error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// PATCH /api/v1/tables/:id/status
// Bọc trong transaction + FOR UPDATE trên hàng dining_tables.
// order.create() cũng khoá hàng này bằng FOR UPDATE trước khi tạo đơn, nên
// hai thao tác "đổi bàn về trống" và "mở đơn cho bàn" được tuần tự hoá:
// nếu chỉ kiểm tra rồi UPDATE rời rạc, một đơn có thể được tạo xen giữa
// bước kiểm tra và bước cập nhật, khiến bàn bị đánh dấu trống dù đang có đơn.
const updateStatus = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { status } = req.body;
    const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const tableResult = await client.query(
      'SELECT id FROM dining_tables WHERE id=$1 FOR UPDATE',
      [req.params.id]
    );
    if (!tableResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy bàn.' });
    }

    // Không cho phép đặt bàn về available/maintenance khi còn đơn hàng đang hoạt động
    if (['available', 'maintenance'].includes(status)) {
      const activeOrders = await client.query(
        "SELECT COUNT(*) AS cnt FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled')",
        [req.params.id]
      );
      if (parseInt(activeOrders.rows[0].cnt) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Bàn đang có đơn hàng hoạt động. Hãy hoàn thành hoặc hủy đơn trước khi thay đổi trạng thái bàn.',
        });
      }
    }

    const result = await client.query(
      'UPDATE dining_tables SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Update table status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  } finally {
    client.release();
  }
};

// DELETE /api/v1/tables/:id
const remove = async (req, res) => {
  try {
    const orderCheck = await query(
      "SELECT COUNT(*) AS cnt FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled')",
      [req.params.id]
    );
    if (parseInt(orderCheck.rows[0].cnt) > 0) {
      return res.status(409).json({ success: false, message: 'Không thể xóa bàn đang có đơn hàng.' });
    }
    const result = await query('DELETE FROM dining_tables WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy bàn.' });
    res.json({ success: true, message: 'Xóa bàn thành công.' });
  } catch (err) {
    logger.error('Delete table error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/tables/:id/transfer - Chuyển bàn
const transferTable = async (req, res) => {
  const { getClient } = require('../config/database');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sourceId = req.params.id;
    const { target_table_id } = req.body;

    if (!target_table_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bàn đích là bắt buộc.' });
    }

    // Kiểm tra bàn đích
    const targetTable = await client.query('SELECT * FROM dining_tables WHERE id=$1 FOR UPDATE', [target_table_id]);
    if (!targetTable.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy bàn đích.' });
    }
    if (targetTable.rows[0].status === 'occupied') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bàn đích hiện đang có khách. Vui lòng chọn bàn trống hoặc sử dụng tính năng gộp bàn.' });
    }

    // Lấy đơn hàng active của bàn nguồn
    const activeOrder = await client.query(
      "SELECT * FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled') LIMIT 1 FOR UPDATE",
      [sourceId]
    );

    if (!activeOrder.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bàn nguồn không có đơn hàng nào đang hoạt động.' });
    }

    // Cập nhật đơn hàng sang bàn đích
    await client.query('UPDATE orders SET table_id=$1 WHERE id=$2', [target_table_id, activeOrder.rows[0].id]);

    // Cập nhật trạng thái 2 bàn
    await client.query("UPDATE dining_tables SET status='available' WHERE id=$1", [sourceId]);
    await client.query("UPDATE dining_tables SET status='occupied' WHERE id=$1", [target_table_id]);

    await client.query('COMMIT');
    res.json({
      success: true,
      message: `Đã chuyển đơn hàng từ bàn thành công sang Bàn ${targetTable.rows[0].table_number}.`,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Transfer table error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi chuyển bàn.' });
  } finally {
    client.release();
  }
};

// POST /api/v1/tables/:id/merge - Gộp bàn
const mergeTables = async (req, res) => {
  const { getClient } = require('../config/database');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const sourceId = req.params.id;
    const { target_table_id } = req.body;

    if (!target_table_id || target_table_id == sourceId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bàn đích không hợp lệ.' });
    }

    const sourceOrder = await client.query(
      "SELECT * FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled') LIMIT 1 FOR UPDATE",
      [sourceId]
    );
    const targetOrder = await client.query(
      "SELECT * FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled') LIMIT 1 FOR UPDATE",
      [target_table_id]
    );

    if (!sourceOrder.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Bàn nguồn không có đơn hàng hoạt động.' });
    }

    if (!targetOrder.rows[0]) {
      // Nếu bàn đích chưa có đơn, chuyển luôn sang
      await client.query('UPDATE orders SET table_id=$1 WHERE id=$2', [target_table_id, sourceOrder.rows[0].id]);
      await client.query("UPDATE dining_tables SET status='available' WHERE id=$1", [sourceId]);
      await client.query("UPDATE dining_tables SET status='occupied' WHERE id=$1", [target_table_id]);
    } else {
      // Gộp các items từ đơn nguồn sang đơn đích
      await client.query('UPDATE order_items SET order_id=$1 WHERE order_id=$2', [targetOrder.rows[0].id, sourceOrder.rows[0].id]);

      // Tính lại tổng tiền cho đơn đích
      const recalc = await client.query('SELECT COALESCE(SUM(subtotal), 0) AS total FROM order_items WHERE order_id=$1', [targetOrder.rows[0].id]);
      const newTotal = parseFloat(recalc.rows[0].total);

      await client.query('UPDATE orders SET subtotal=$1, total_amount=$1 WHERE id=$2', [newTotal, targetOrder.rows[0].id]);

      // Hủy hoặc xóa đơn nguồn
      await client.query("UPDATE orders SET status='cancelled', note='Gộp vào đơn ' || $1 WHERE id=$2", [targetOrder.rows[0].order_code, sourceOrder.rows[0].id]);
      await client.query("UPDATE dining_tables SET status='available' WHERE id=$1", [sourceId]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Gộp bàn thành công.' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Merge table error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi gộp bàn.' });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, update, remove, updateStatus, getCurrentOrder, transferTable, mergeTables };
