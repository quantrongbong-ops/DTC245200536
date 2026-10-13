// ============================================================
// INTEGRATION TEST - Kiểm thử đồng thời (race condition)
//
// Đặc điểm: gọi HTTP API thật + ghi/đọc PostgreSQL thật.
// Các request được gửi ĐỒNG THỜI bằng Promise.all, rồi kiểm tra
// database để chứng minh ràng buộc ở tầng dữ liệu đã chặn tranh chấp.
//
// Đây là nhóm test quan trọng nhất để chứng minh hệ thống không chỉ
// kiểm tra ở giao diện. Nếu chỉ dựa vào kiểm tra phía client, tất cả
// các tình huống dưới đây đều sẽ tạo ra dữ liệu sai.
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');
const { pool } = require('../src/config/database');

let adminToken;
let staffToken;
const createdTableIds = [];
const createdOrderIds = [];

// Tạo bàn riêng cho từng bài test để không ảnh hưởng bài khác
const createTable = async (suffix) => {
  const num = `CT${Date.now().toString().slice(-6)}${suffix}`.slice(0, 10);
  const res = await request(app)
    .post('/api/v1/tables')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ table_number: num, area: 'Khu test dong thoi', capacity: 4 });
  if (res.status === 201) createdTableIds.push(res.body.data.id);
  return res.body.data;
};

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
});

afterAll(async () => {
  // Dọn dẹp: hủy đơn rồi xóa bàn do test tạo ra
  for (const id of createdOrderIds) {
    try { await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [id]); } catch {}
  }
  for (const id of createdTableIds) {
    try {
      await pool.query(
        "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE table_id=$1)", [id]
      );
      await pool.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE table_id=$1)', [id]);
      await pool.query('DELETE FROM orders WHERE table_id=$1', [id]);
      await pool.query('DELETE FROM dining_tables WHERE id=$1', [id]);
    } catch {}
  }
});

describe('ĐỒNG THỜI - Hai request mở đơn cho cùng một bàn', () => {
  test('chỉ ĐÚNG MỘT request thành công, request còn lại bị chặn 409', async () => {
    const table = await createTable('A');
    const payload = {
      table_id: table.id,
      items: [{ menu_item_id: 1, quantity: 1 }],
    };

    // Gửi 5 request ĐỒNG THỜI cho cùng một bàn
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/orders')
          .set('Authorization', `Bearer ${staffToken}`)
          .send(payload)
      )
    );

    const created = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);
    const others = responses.filter((r) => r.status !== 201 && r.status !== 409);

    expect(created).toHaveLength(1);
    expect(conflicts).toHaveLength(4);
    expect(others).toHaveLength(0);

    created.forEach((r) => createdOrderIds.push(r.body.data.id));

    // Xác nhận ở tầng DATABASE: chỉ có 1 đơn hoạt động cho bàn này
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled')",
      [table.id]
    );
    expect(rows[0].cnt).toBe(1);
  });
});

describe('ĐỒNG THỜI - Hai request thanh toán cùng một đơn', () => {
  test('chỉ ĐÚNG MỘT bản ghi payment được tạo', async () => {
    const table = await createTable('B');

    // Mở đơn và đưa tới trạng thái 'served' để có thể thanh toán
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: table.id, items: [{ menu_item_id: 1, quantity: 2 }] });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;
    createdOrderIds.push(orderId);

    await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'served' });

    // Gửi 4 request thanh toán ĐỒNG THỜI
    const responses = await Promise.all(
      Array.from({ length: 4 }, () =>
        request(app)
          .post('/api/v1/payments')
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ order_id: orderId, method: 'cash' })
      )
    );

    const succeeded = responses.filter((r) => r.status === 201);
    const rejected = responses.filter((r) => r.status === 409 || r.status === 400);

    expect(succeeded).toHaveLength(1);
    expect(succeeded.length + rejected.length).toBe(4);

    // Xác nhận ở tầng DATABASE bằng truy vấn trực tiếp
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM payments WHERE order_id=$1',
      [orderId]
    );
    expect(rows[0].cnt).toBe(1);
  });
});

describe('ĐỒNG THỜI - Nhiều request thêm món vào cùng một đơn', () => {
  test('không mất dòng nào và tổng tiền cộng đúng (không lost update)', async () => {
    const table = await createTable('C');

    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: table.id, items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    const orderId = orderRes.body.data.id;
    createdOrderIds.push(orderId);

    // Món 1 = Gỏi cuốn, giá 55000. Thêm 8 lần đồng thời, mỗi lần 1 suất.
    const N = 8;
    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post(`/api/v1/orders/${orderId}/items`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ items: [{ menu_item_id: 1, quantity: 1 }] })
      )
    );

    expect(responses.filter((r) => r.status === 201)).toHaveLength(N);

    // Đơn ban đầu 1 dòng + 8 dòng thêm = 9 dòng
    const items = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM order_items WHERE order_id=$1',
      [orderId]
    );
    expect(items.rows[0].cnt).toBe(N + 1);

    // Tổng tiền phải khớp: 9 × 55000 = 495000
    const order = await pool.query(
      'SELECT total_amount::text AS total FROM orders WHERE id=$1',
      [orderId]
    );
    expect(parseFloat(order.rows[0].total)).toBe(9 * 55000);

    // orders.total_amount phải bằng tổng subtotal thật của các dòng
    const sum = await pool.query(
      'SELECT COALESCE(SUM(subtotal),0)::text AS s FROM order_items WHERE order_id=$1',
      [orderId]
    );
    expect(parseFloat(sum.rows[0].s)).toBe(parseFloat(order.rows[0].total));
  });
});

describe('ĐỒNG THỜI - Đổi trạng thái bàn và mở đơn cùng lúc', () => {
  test('không thể đánh dấu bàn trống trong khi đơn đang được tạo', async () => {
    const table = await createTable('D');

    // Chạy song song: (1) mở đơn cho bàn, (2) đổi bàn về 'available'
    const [orderRes, statusRes] = await Promise.all([
      request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ table_id: table.id, items: [{ menu_item_id: 1, quantity: 1 }] }),
      request(app)
        .patch(`/api/v1/tables/${table.id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'available' }),
    ]);

    if (orderRes.status === 201) createdOrderIds.push(orderRes.body.data.id);

    // Trạng thái CUỐI CÙNG của bàn phải nhất quán với đơn hàng
    const { rows } = await pool.query(
      'SELECT status FROM dining_tables WHERE id=$1',
      [table.id]
    );
    const finalStatus = rows[0].status;

    if (orderRes.status === 201) {
      // Có đơn hoạt động → bàn BẮT BUỘC phải là 'occupied'
      expect(finalStatus).toBe('occupied');
    } else {
      // Không tạo được đơn → bàn có thể ở 'available'
      expect(['available', 'occupied']).toContain(finalStatus);
    }

    // Bất biến quan trọng: KHÔNG bao giờ có bàn 'available' mà vẫn còn đơn hoạt động
    const active = await pool.query(
      "SELECT COUNT(*)::int AS cnt FROM orders WHERE table_id=$1 AND status NOT IN ('completed','cancelled')",
      [table.id]
    );
    if (active.rows[0].cnt > 0) {
      expect(finalStatus).not.toBe('available');
    }

    // statusRes chỉ được 200 (đổi thành công) hoặc 409 (bị chặn)
    expect([200, 409]).toContain(statusRes.status);
  });
});

describe('ĐỒNG THỜI - Ràng buộc tầng database', () => {
  test('UNIQUE trên payments.order_id chặn bản ghi trùng ở mức DB', async () => {
    const table = await createTable('E');
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: table.id, items: [{ menu_item_id: 1, quantity: 1 }] });
    const orderId = orderRes.body.data.id;
    createdOrderIds.push(orderId);

    await pool.query(
      "INSERT INTO payments (order_id, amount, method, status, paid_at) VALUES ($1, 1000, 'cash', 'completed', NOW())",
      [orderId]
    );

    // Lần chèn thứ hai phải bị PostgreSQL từ chối với mã lỗi 23505
    let code = null;
    try {
      await pool.query(
        "INSERT INTO payments (order_id, amount, method, status, paid_at) VALUES ($1, 2000, 'cash', 'completed', NOW())",
        [orderId]
      );
    } catch (err) {
      code = err.code;
    }
    expect(code).toBe('23505');
  });

  test('CHECK quantity > 0 chặn số lượng không hợp lệ ở mức DB', async () => {
    const table = await createTable('F');
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: table.id, items: [{ menu_item_id: 1, quantity: 1 }] });
    const orderId = orderRes.body.data.id;
    createdOrderIds.push(orderId);

    let code = null;
    try {
      await pool.query(
        'INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price) VALUES ($1, 1, 0, 1000)',
        [orderId]
      );
    } catch (err) {
      code = err.code;
    }
    expect(code).toBe('23514'); // check_violation
  });

  test('khoá ngoại chặn đơn trỏ tới bàn không tồn tại', async () => {
    let code = null;
    try {
      await pool.query(
        "INSERT INTO orders (order_code, table_id, status) VALUES ('CTFK999', 99999999, 'pending')"
      );
    } catch (err) {
      code = err.code;
    }
    expect(code).toBe('23503'); // foreign_key_violation
  });
});
