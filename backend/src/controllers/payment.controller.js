// ============================================================
// Payment Controller
// ============================================================
const { query, getClient } = require('../config/database');
const { recordCompletedOrder } = require('../utils/metrics');
const logger = require('../utils/logger');

// POST /api/v1/payments - Thanh toán đơn hàng
const createPayment = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { order_id, method = 'cash', note } = req.body;
    if (!order_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Mã đơn hàng là bắt buộc.' });
    }

    const validMethods = ['cash', 'card', 'transfer', 'other'];
    if (!validMethods.includes(method)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Phương thức thanh toán không hợp lệ.' });
    }

    // Kiểm tra đơn hàng
    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id=$1 FOR UPDATE',
      [order_id]
    );
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const order = orderResult.rows[0];
    if (!['served', 'ready'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Chỉ có thể thanh toán đơn hàng ở trạng thái đã phục vụ.',
      });
    }

    // Kiểm tra đã thanh toán chưa
    const existingPayment = await client.query(
      "SELECT id FROM payments WHERE order_id=$1 AND status='completed'",
      [order_id]
    );
    if (existingPayment.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Đơn hàng này đã được thanh toán.' });
    }

    // Tạo payment
    const paymentResult = await client.query(
      `INSERT INTO payments (order_id, amount, method, status, note, paid_at)
       VALUES ($1, $2, $3, 'completed', $4, NOW()) RETURNING *`,
      [order_id, order.total_amount, method, note || null]
    );

    // Cập nhật trạng thái đơn hàng
    await client.query(
      "UPDATE orders SET status='completed' WHERE id=$1",
      [order_id]
    );

    // Giải phóng bàn
    await client.query(
      "UPDATE dining_tables SET status='available' WHERE id=$1",
      [order.table_id]
    );

    await client.query('COMMIT');

    // Ghi nhận doanh thu SAU khi transaction đã commit thành công.
    // Nếu gọi trước COMMIT mà transaction rollback thì metric sẽ đếm khống.
    recordCompletedOrder(order.total_amount);

    logger.info('Payment completed:', {
      orderId: order_id,
      amount: order.total_amount,
      method,
      by: req.user?.username,
    });

    res.status(201).json({
      success: true,
      message: 'Thanh toán thành công.',
      data: paymentResult.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Create payment error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi xử lý thanh toán.' });
  } finally {
    client.release();
  }
};

// GET /api/v1/payments?from=&to=
// from/to là mốc thời gian ISO. Nếu client gửi chuỗi không phải ngày,
// PostgreSQL sẽ báo lỗi 22007 và API trả HTTP 500 → phải chặn trước.
const parseDateInput = (value, label) => {
  if (value === undefined || value === null || value === '') return { value: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { error: `${label} không đúng định dạng thời gian (ví dụ: 2026-10-13 hoặc 2026-10-13T00:00:00).` };
  }
  return { value: parsed.toISOString() };
};

const getPayments = async (req, res) => {
  try {
    const conditions = [];
    const params = [];

    const fromCheck = parseDateInput(req.query.from, 'Tham số "from"');
    if (fromCheck.error) return res.status(400).json({ success: false, message: fromCheck.error });
    const toCheck = parseDateInput(req.query.to, 'Tham số "to"');
    if (toCheck.error) return res.status(400).json({ success: false, message: toCheck.error });

    if (fromCheck.value) {
      params.push(fromCheck.value);
      conditions.push(`p.paid_at >= $${params.length}`);
    }
    if (toCheck.value) {
      params.push(toCheck.value);
      conditions.push(`p.paid_at <= $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(`
      SELECT p.*, o.order_code, dt.table_number
      FROM payments p
      JOIN orders o ON p.order_id = o.id
      JOIN dining_tables dt ON o.table_id = dt.id
      ${where}
      ORDER BY p.paid_at DESC
      LIMIT 100
    `, params);

    const totalRevenue = result.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    res.json({ success: true, data: result.rows, total_revenue: totalRevenue });
  } catch (err) {
    logger.error('Get payments error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

module.exports = { createPayment, getPayments };
