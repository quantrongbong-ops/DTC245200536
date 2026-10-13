// ============================================================
// Kiểm thử thanh toán: chống thanh toán trùng, trạng thái hợp lệ,
// phân quyền xem danh sách thanh toán
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');
const { pool } = require('../src/config/database');

let adminToken, staffToken, orderId;

const createServedOrder = async () => {
  // Tìm bàn trống
  const tablesRes = await request(app).get('/api/v1/tables').set('Authorization', `Bearer ${staffToken}`);
  const free = tablesRes.body.data.find((t) => t.status === 'available');
  expect(free).toBeDefined();

  // Tạo đơn (Gỏi cuốn 55000 x1)
  const orderRes = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${staffToken}`)
    .send({ table_id: free.id, items: [{ menu_item_id: 1, quantity: 1 }], note: 'Đơn test thanh toán' });
  expect(orderRes.status).toBe(201);
  orderId = orderRes.body.data.id;

  // Chuyển trạng thái tới served
  for (const status of ['confirmed', 'preparing', 'served']) {
    const r = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status });
    expect(r.status).toBe(200);
  }
  return orderRes.body.data;
};

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
});

afterAll(async () => {
  try { await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [orderId]); } catch {}
});

describe('PAYMENTS /api/v1/payments', () => {
  test('Không thể thanh toán đơn đang pending → 409', async () => {
    const tablesRes = await request(app).get('/api/v1/tables').set('Authorization', `Bearer ${staffToken}`);
    const free = tablesRes.body.data.find((t) => t.status === 'available');
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: free.id, items: [{ menu_item_id: 1, quantity: 1 }] });

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ order_id: orderRes.body.data.id, method: 'cash' });
    expect(payRes.status).toBe(409);

    // Hủy đơn để trả bàn
    await request(app)
      .patch(`/api/v1/orders/${orderRes.body.data.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' });
  });

  test('Thanh toán đơn đã phục vụ → 201, đơn thành completed, bàn được giải phóng', async () => {
    const order = await createServedOrder();

    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ order_id: order.id, method: 'cash' });
    expect(payRes.status).toBe(201);
    expect(parseFloat(payRes.body.data.amount)).toBe(55000);

    // Đơn phải chuyển completed
    const orderAfter = await request(app).get(`/api/v1/orders/${order.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(orderAfter.body.data.status).toBe('completed');
  });

  test('Thanh toán trùng → 409', async () => {
    const payRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ order_id: orderId, method: 'card' });
    expect(payRes.status).toBe(409);
  });

  test('Staff không được xem danh sách thanh toán → 403', async () => {
    const res = await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('Admin xem được danh sách thanh toán → 200', async () => {
    const res = await request(app).get('/api/v1/payments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total_revenue).toBe('number');
  });
});
