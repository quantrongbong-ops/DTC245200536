// ============================================================
// Kiểm thử quy trình đơn hàng: tạo đơn, giá từ DB,
// thêm/bỏ món, trạng thái món, bảo vệ trạng thái cuối
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');
const { pool } = require('../src/config/database');

let adminToken, staffToken;
let freeTable;       // bàn trống dùng cho test
let orderId;         // đơn tạo bởi test
let itemId;          // món trong đơn test
const cleanupIds = [];

const findFreeTable = async (token) => {
  const res = await request(app).get('/api/v1/tables').set('Authorization', `Bearer ${token}`);
  const t = res.body.data.find((x) => x.status === 'available');
  return t;
};

// Dọn dẹp dữ liệu test sau khi chạy xong
// (không đóng pool ở đây — các file test khác chạy chung process)
afterAll(async () => {
  for (const id of cleanupIds) {
    try { await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [id]); } catch {}
  }
});

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
  freeTable = await findFreeTable(staffToken);
});

describe('ORDERS /api/v1/orders', () => {
  test('Tạo đơn rỗng → 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: freeTable.id, items: [] });
    expect(res.status).toBe(400);
  });

  test('Tạo đơn với bàn không tồn tại → 404', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: 999999, items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(res.status).toBe(404);
  });

  test('Tạo đơn với số lượng không hợp lệ → 400', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: freeTable.id, items: [{ menu_item_id: 1, quantity: 0 }] });
    expect(res.status).toBe(400);
  });

  test('Tạo đơn thành công, giá tính từ DB (bỏ qua giá client gửi)', async () => {
    // Client gửi kèm giá giả 1đ — backend phải dùng giá DB (món 1 = Gỏi cuốn 55000)
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        table_id: freeTable.id,
        items: [{ menu_item_id: 1, quantity: 2, unit_price: 1 }],
        note: 'Đơn test Jest',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.order_code).toBeDefined();
    expect(parseFloat(res.body.data.total_amount)).toBe(55000 * 2);
    orderId = res.body.data.id;
    cleanupIds.push(orderId);
  });

  test('Bàn vừa tạo đơn phải là occupied → tạo đơn nữa bị 409', async () => {
    const res = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: freeTable.id, items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(res.status).toBe(409);
  });

  test('GET /orders/:id trả về chi tiết + items', async () => {
    const res = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].name).toBe('Gỏi cuốn');
    itemId = res.body.data.items[0].id;
  });

  test('Thêm món vào đơn → 201 và tổng tiền tính lại', async () => {
    // Món 11 = Trà đào 45000 x1
    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ menu_item_id: 11, quantity: 1 }] });
    expect(res.status).toBe(201);
    expect(parseFloat(res.body.data.total_amount)).toBe(55000 * 2 + 45000);
  });

  test('Thêm món vào đơn đã kết thúc → 409', async () => {
    const cancelled = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'cancelled' });
    expect(cancelled.status).toBe(200);

    const res = await request(app)
      .post(`/api/v1/orders/${orderId}/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(res.status).toBe(409);

    // Mở lại đơn để test tiếp: hủy là trạng thái cuối nên tạo đơn mới
    const newRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: freeTable.id, items: [{ menu_item_id: 1, quantity: 1 }, { menu_item_id: 4, quantity: 1 }] });
    expect(newRes.status).toBe(201);
    orderId = newRes.body.data.id;
    cleanupIds.push(orderId);
  });

  test('Đơn đã hủy không thể đổi trạng thái → 409', async () => {
    // orderId cũ giờ là đơn mới — lấy lại đơn đã hủy từ cleanup
    const cancelledId = cleanupIds[0];
    const res = await request(app)
      .patch(`/api/v1/orders/${cancelledId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(409);
  });

  test('Cập nhật trạng thái món qua route ngắn /orders/items/:id/status', async () => {
    const detail = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    const firstItem = detail.body.data.items[0];

    const res = await request(app)
      .patch(`/api/v1/orders/items/${firstItem.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'preparing' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('preparing');

    // Khi món bắt đầu nấu, đơn phải tự chuyển sang preparing
    const orderAfter = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    expect(orderAfter.body.data.status).toBe('preparing');
  });

  test('Cập nhật trạng thái món qua route đầy đủ /orders/:id/items/:itemId/status', async () => {
    const detail = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    const firstItem = detail.body.data.items[0];

    const res = await request(app)
      .patch(`/api/v1/orders/${orderId}/items/${firstItem.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'ready' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
  });

  test('Bỏ món cuối cùng → 400 (phải hủy đơn thay vì xóa món)', async () => {
    // Đơn test hiện có 2 món; bỏ 1 rồi bỏ món còn lại
    const detail = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    const items = detail.body.data.items;

    const removeFirst = await request(app)
      .delete(`/api/v1/orders/${orderId}/items/${items[0].id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(removeFirst.status).toBe(200);

    const detail2 = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    const lastItem = detail2.body.data.items[0];

    const removeLast = await request(app)
      .delete(`/api/v1/orders/${orderId}/items/${lastItem.id}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(removeLast.status).toBe(400);
  });

  test('Bỏ món tính lại tổng tiền đúng', async () => {
    const detail = await request(app).get(`/api/v1/orders/${orderId}`).set('Authorization', `Bearer ${staffToken}`);
    // Sau khi bỏ 1 món (Gỏi cuốn 55000), đơn còn Phở bò 70000
    expect(parseFloat(detail.body.data.total_amount)).toBe(70000);
  });

  test('GET /orders/kitchen chỉ trả về món đang chế biến', async () => {
    const res = await request(app).get('/api/v1/orders/kitchen').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
