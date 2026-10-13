// ============================================================
// Order Controller - Sử dụng PostgreSQL Transaction
// ============================================================
const { query, getClient } = require('../config/database');
const { ordersCreated, recordCompletedOrder } = require('../utils/metrics');
const { parsePositiveInt } = require('../utils/query');
const { sumLineTotals, calcOrderTotal } = require('../utils/money');
const { parseQuantityInput } = require('../utils/validation');
const logger = require('../utils/logger');

// GET /api/v1/orders?status=&table_id=&page=1&limit=20
const getAll = async (req, res) => {
  try {
    const page  = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20, 100);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];

    if (req.query.status) {
      params.push(req.query.status);
      conditions.push(`o.status = $${params.length}`);
    }
    if (req.query.table_id) {
      params.push(req.query.table_id);
      conditions.push(`o.table_id = $${params.length}`);
    }
    if (req.query.date) {
      params.push(req.query.date);
      conditions.push(`DATE(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') = $${params.length}`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query(`SELECT COUNT(*) AS total FROM orders o ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    params.push(limit, offset);
    const result = await query(`
      SELECT o.*, dt.table_number, u.full_name AS staff_name,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) AS item_count
      FROM orders o
      JOIN dining_tables dt ON o.table_id = dt.id
      LEFT JOIN users u ON o.user_id = u.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('Get orders error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// GET /api/v1/orders/:id
const getById = async (req, res) => {
  try {
    const orderResult = await query(`
      SELECT o.*, dt.table_number, dt.area, u.full_name AS staff_name
      FROM orders o
      JOIN dining_tables dt ON o.table_id = dt.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.id = $1
    `, [req.params.id]);

    if (!orderResult.rows[0]) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });

    const itemsResult = await query(`
      SELECT oi.*, mi.name, mi.image_url, c.name AS category_name
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN categories c ON mi.category_id = c.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at
    `, [req.params.id]);

    res.json({ success: true, data: { ...orderResult.rows[0], items: itemsResult.rows } });
  } catch (err) {
    logger.error('Get order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// POST /api/v1/orders - Tạo đơn hàng với Transaction
const create = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { table_id, items, note } = req.body;

    // items phải là mảng không rỗng. Nếu client gửi chuỗi/số thì items.map()
    // sẽ ném TypeError và rơi vào catch → trả 500 sai ngữ nghĩa.
    if (!table_id || !Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Vui lòng chọn bàn và ít nhất 1 món.' });
    }

    // Kiểm tra bàn có available không
    const tableResult = await client.query(
      'SELECT * FROM dining_tables WHERE id = $1 FOR UPDATE',
      [table_id]
    );
    if (!tableResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy bàn.' });
    }
    if (tableResult.rows[0].status === 'occupied') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Bàn này đang có khách. Vui lòng chọn bàn khác hoặc thêm món vào đơn hiện tại.' });
    }

    // Lấy giá từ DB (không tin frontend)
    const menuIds = items.map(i => i.menu_item_id);
    const menuResult = await client.query(
      'SELECT id, price, name, is_available FROM menu_items WHERE id = ANY($1)',
      [menuIds]
    );

    const menuMap = {};
    for (const m of menuResult.rows) {
      if (!m.is_available) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món "${m.name}" hiện không có sẵn.` });
      }
      menuMap[m.id] = m;
    }

    // Tính tổng tiền từ giá trong DB (không tin giá do client gửi)
    const lines = [];
    for (const item of items) {
      const menu = menuMap[item.menu_item_id];
      if (!menu) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món ID ${item.menu_item_id} không tồn tại.` });
      }
      const qty = parseQuantityInput(item.quantity);
      if (qty.error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: qty.error });
      }
      lines.push({ unit_price: menu.price, quantity: qty.value });
    }
    // sumLineTotals cộng trên số nguyên đơn vị nhỏ nhất → không tích luỹ sai số
    const subtotal = sumLineTotals(lines);
    const totalAmount = calcOrderTotal(subtotal, 0);

    // Sinh mã đơn hàng
    const codeResult = await client.query('SELECT generate_order_code() AS code');
    const orderCode = codeResult.rows[0].code;

    // Tạo đơn hàng
    const orderResult = await client.query(
      `INSERT INTO orders (order_code, table_id, user_id, note, subtotal, total_amount)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [orderCode, table_id, req.user?.id || null, note || null, subtotal, totalAmount]
    );
    const order = orderResult.rows[0];

    // Tạo chi tiết đơn hàng
    for (const item of items) {
      const unitPrice = parseFloat(menuMap[item.menu_item_id].price);
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.menu_item_id, item.quantity, unitPrice, item.note || null]
      );
    }

    // Cập nhật trạng thái bàn
    await client.query(
      "UPDATE dining_tables SET status = 'occupied' WHERE id = $1",
      [table_id]
    );

    await client.query('COMMIT');

    ordersCreated.inc();
    logger.info('Order created:', { orderCode, tableId: table_id, total: totalAmount, by: req.user?.username });

    res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công.',
      data: { ...order, items },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Create order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi tạo đơn hàng.' });
  } finally {
    client.release();
  }
};

// ============================================================
// Order Items helpers (dùng chung cho addItems / removeItem)
// ============================================================

// Lấy đơn hàng + khóa row (phải còn hoạt động)
const lockActiveOrder = async (client, orderId, res) => {
  const orderResult = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
  if (!orderResult.rows[0]) {
    await client.query('ROLLBACK');
    res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    return null;
  }
  if (['completed', 'cancelled'].includes(orderResult.rows[0].status)) {
    await client.query('ROLLBACK');
    res.status(409).json({ success: false, message: 'Đơn hàng đã kết thúc, không thể thay đổi món.' });
    return null;
  }
  return orderResult.rows[0];
};

// Lấy giá & trạng thái món từ DB (không tin giá từ client)
const fetchMenuMap = async (client, menuIds) => {
  const menuResult = await client.query(
    'SELECT id, price, name, is_available FROM menu_items WHERE id = ANY($1)',
    [menuIds]
  );
  const map = {};
  for (const m of menuResult.rows) map[m.id] = m;
  return map;
};

// Tính lại subtotal/total từ order_items
const recalcOrderTotals = async (client, orderId) => {
  const sumResult = await client.query(
    'SELECT COALESCE(SUM(subtotal), 0) AS subtotal FROM order_items WHERE order_id = $1',
    [orderId]
  );
  const subtotal = parseFloat(sumResult.rows[0].subtotal);
  await client.query(
    'UPDATE orders SET subtotal = $1, total_amount = $1 WHERE id = $2',
    [subtotal, orderId]
  );
  return subtotal;
};

// POST /api/v1/orders/:id/items - Thêm món vào đơn đang hoạt động
const addItems = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { items, note } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất 1 món.' });
    }

    const order = await lockActiveOrder(client, req.params.id, res);
    if (!order) return;

    // Lấy giá từ DB và kiểm tra tính sẵn có
    const menuMap = await fetchMenuMap(client, items.map(i => i.menu_item_id));
    for (const item of items) {
      const menu = menuMap[item.menu_item_id];
      if (!menu) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món ID ${item.menu_item_id} không tồn tại.` });
      }
      if (!menu.is_available) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Món "${menu.name}" hiện không có sẵn.` });
      }
      const qty = parseQuantityInput(item.quantity);
      if (qty.error) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: qty.error });
      }
    }

    const insertedItems = [];
    for (const item of items) {
      const unitPrice = parseFloat(menuMap[item.menu_item_id].price);
      const ins = await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, note)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [order.id, item.menu_item_id, item.quantity, unitPrice, item.note || null]
      );
      insertedItems.push(ins.rows[0]);
    }

    const subtotal = await recalcOrderTotals(client, order.id);

    // Đồng bộ ghi chú đơn nếu có ghi chú mới
    if (note && note.trim()) {
      await client.query('UPDATE orders SET note = $1 WHERE id = $2', [note.trim(), order.id]);
    }

    await client.query('COMMIT');

    logger.info('Items added to order:', { orderId: order.id, orderCode: order.order_code, items: items.length, subtotal, by: req.user?.username });

    res.status(201).json({
      success: true,
      message: 'Thêm món thành công.',
      data: { order_id: order.id, order_code: order.order_code, subtotal, total_amount: subtotal, items: insertedItems },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Add items error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi thêm món.' });
  } finally {
    client.release();
  }
};

// DELETE /api/v1/orders/:id/items/:itemId - Bỏ món khỏi đơn
const removeItem = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const order = await lockActiveOrder(client, req.params.id, res);
    if (!order) return;

    const itemResult = await client.query(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2 FOR UPDATE',
      [req.params.itemId, order.id]
    );
    if (!itemResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy món trong đơn hàng.' });
    }

    const remaining = await client.query(
      'SELECT COUNT(*) AS cnt FROM order_items WHERE order_id = $1',
      [order.id]
    );
    if (parseInt(remaining.rows[0].cnt) <= 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Không thể bỏ món cuối cùng. Hãy hủy đơn hàng thay vì xóa món.',
      });
    }

    await client.query('DELETE FROM order_items WHERE id = $1', [req.params.itemId]);

    const subtotal = await recalcOrderTotals(client, order.id);
    await client.query('COMMIT');

    logger.info('Item removed from order:', { orderId: order.id, itemId: req.params.itemId, subtotal, by: req.user?.username });

    res.json({ success: true, message: 'Đã bỏ món khỏi đơn hàng.', data: { subtotal, total_amount: subtotal } });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Remove item error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi bỏ món.' });
  } finally {
    client.release();
  }
};

// PATCH /api/v1/orders/:id/items/:itemId/status
// PATCH /api/v1/orders/items/:itemId/status (route ngắn gọn)
const updateItemStatus = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { status } = req.body;
    const validStatuses = ['pending', 'preparing', 'ready', 'served', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Trạng thái món không hợp lệ.' });
    }

    // Hỗ trợ cả 2 dạng route: có order_id hoặc chỉ có item_id
    let orderId = req.params.itemId ? req.params.id : null;
    const itemId = req.params.itemId || req.params.id;
    if (!orderId) {
      const itemLookup = await client.query('SELECT order_id FROM order_items WHERE id = $1 FOR UPDATE', [itemId]);
      if (!itemLookup.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Không tìm thấy món trong đơn hàng.' });
      }
      orderId = itemLookup.rows[0].order_id;
    }

    const order = await lockActiveOrder(client, orderId, res);
    if (!order) return;

    const itemResult = await client.query(
      'SELECT * FROM order_items WHERE id = $1 AND order_id = $2 FOR UPDATE',
      [itemId, order.id]
    );
    if (!itemResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy món trong đơn hàng.' });
    }

    const updatedItem = await client.query(
      'UPDATE order_items SET status = $1 WHERE id = $2 RETURNING *',
      [status, itemId]
    );

    // Nếu món bắt đầu chế biến mà đơn còn pending/confirmed thì chuyển đơn sang preparing
    if (status === 'preparing' && ['pending', 'confirmed'].includes(order.status)) {
      await client.query("UPDATE orders SET status = 'preparing' WHERE id = $1", [order.id]);
    }

    await client.query('COMMIT');

    logger.info('Order item status updated:', { orderId: order.id, itemId, status, by: req.user?.username });

    res.json({ success: true, message: 'Cập nhật trạng thái món thành công.', data: updatedItem.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Update item status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  } finally {
    client.release();
  }
};

// PATCH /api/v1/orders/:id/status
const updateStatus = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ.' });
    }

    const orderResult = await client.query(
      'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const order = orderResult.rows[0];

    // Không cho phép thay đổi trạng thái của đơn đã kết thúc
    if (['completed', 'cancelled'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Không thể thay đổi trạng thái của đơn hàng đã ${order.status === 'completed' ? 'hoàn thành' : 'hủy'}.`,
      });
    }

    // Cập nhật trạng thái đơn hàng
    const updatedOrder = await client.query(
      'UPDATE orders SET status=$1 WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );

    // Nếu hoàn thành hoặc hủy → giải phóng bàn
    if (status === 'completed' || status === 'cancelled') {
      const activeOrders = await client.query(
        "SELECT COUNT(*) AS cnt FROM orders WHERE table_id=$1 AND id!=$2 AND status NOT IN ('completed','cancelled')",
        [order.table_id, order.id]
      );
      if (parseInt(activeOrders.rows[0].cnt) === 0) {
        await client.query(
          "UPDATE dining_tables SET status='available' WHERE id=$1",
          [order.table_id]
        );
      }
      if (status === 'completed') {
        recordCompletedOrder(order.total_amount);
      }
    }

    await client.query('COMMIT');
    logger.info('Order status updated:', { orderId: req.params.id, newStatus: status, by: req.user?.username });

    res.json({ success: true, message: 'Cập nhật trạng thái thành công.', data: updatedOrder.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Update order status error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  } finally {
    client.release();
  }
};

// GET /api/v1/orders/kitchen - Đơn hàng bếp
const getKitchenOrders = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        oi.id, oi.order_id, oi.menu_item_id, oi.quantity, oi.status, oi.note,
        oi.created_at,
        mi.name AS item_name, mi.image_url,
        o.order_code, o.status AS order_status,
        dt.table_number
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN dining_tables dt ON o.table_id = dt.id
      WHERE o.status IN ('confirmed', 'preparing', 'pending')
        AND oi.status IN ('pending', 'preparing', 'ready')
      ORDER BY oi.created_at ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('Kitchen orders error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  }
};

// DELETE /api/v1/orders/:id (chỉ khi pending)
const remove = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!orderResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }
    if (!['pending', 'cancelled'].includes(orderResult.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Chỉ có thể xóa đơn hàng ở trạng thái pending hoặc đã hủy.' });
    }

    await client.query('DELETE FROM orders WHERE id=$1', [req.params.id]);
    await client.query("UPDATE dining_tables SET status='available' WHERE id=$1", [orderResult.rows[0].table_id]);
    await client.query('COMMIT');

    res.json({ success: true, message: 'Xóa đơn hàng thành công.' });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Delete order error:', err);
    res.status(500).json({ success: false, message: 'Lỗi server.' });
  } finally {
    client.release();
  }
};

module.exports = { getAll, getById, create, updateStatus, getKitchenOrders, remove, addItems, removeItem, updateItemStatus };
