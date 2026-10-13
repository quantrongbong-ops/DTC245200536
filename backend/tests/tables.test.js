// ============================================================
// Kiểm thử bàn ăn: CRUD, trạng thái nhất quán với đơn hàng,
// chuyển bàn và gộp bàn
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');
const { pool } = require('../src/config/database');

let adminToken, staffToken;
let createdTableId = null;
const cleanupOrders = [];

const findFreeTable = async (token, excludeId) => {
  const res = await request(app).get('/api/v1/tables').set('Authorization', `Bearer ${token}`);
  return res.body.data.find((t) => t.status === 'available' && t.id !== excludeId);
};

afterAll(async () => {
  for (const id of cleanupOrders) {
    try { await pool.query("UPDATE orders SET status='cancelled' WHERE id=$1", [id]); } catch {}
  }
  if (createdTableId) {
    try { await pool.query('DELETE FROM dining_tables WHERE id=$1', [createdTableId]); } catch {}
  }
});

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
});

describe('TABLES /api/v1/tables', () => {
  test('Staff không được tạo bàn → 403', async () => {
    const res = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_number: 'T99', capacity: 4 });
    expect(res.status).toBe(403);
  });

  test('Tạo bàn thiếu số bàn → 400', async () => {
    const res = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 4 });
    expect(res.status).toBe(400);
  });

  test('Tạo bàn hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/v1/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ table_number: 'T99', area: 'Test', capacity: 6 });
    expect(res.status).toBe(201);
    createdTableId = res.body.data.id;
  });

  test('Cập nhật bàn thiếu table_number → 400', async () => {
    const res = await request(app)
      .put(`/api/v1/tables/${createdTableId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ capacity: 8 });
    expect(res.status).toBe(400);
  });

  test('Không thể đặt bàn đang có đơn về available → 409', async () => {
    // Tạo đơn trên bàn T99
    const orderRes = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: createdTableId, items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    cleanupOrders.push(orderRes.body.data.id);

    const res = await request(app)
      .patch(`/api/v1/tables/${createdTableId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'available' });
    expect(res.status).toBe(409);
  });

  test('Chuyển bàn: đơn chuyển sang bàn trống, bàn cũ available', async () => {
    const source = createdTableId;
    const target = await findFreeTable(staffToken, source);
    expect(target).toBeDefined();

    const res = await request(app)
      .post(`/api/v1/tables/${source}/transfer`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ target_table_id: target.id });
    expect(res.status).toBe(200);

    const sourceAfter = await request(app).get(`/api/v1/tables/${source}`).set('Authorization', `Bearer ${staffToken}`);
    const targetAfter = await request(app).get(`/api/v1/tables/${target.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(sourceAfter.body.data.status).toBe('available');
    expect(targetAfter.body.data.status).toBe('occupied');
  });

  test('Gộp bàn: gộp items từ 2 đơn, tính lại tổng tiền, hủy đơn nguồn', async () => {
    // Tạo đơn trên 2 bàn trống
    const tableA = await findFreeTable(staffToken, null);
    const tableB = await findFreeTable(staffToken, tableA.id);
    expect(tableA).toBeDefined();
    expect(tableB).toBeDefined();

    // Đơn A: Gỏi cuốn 55000 x1
    const orderA = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: tableA.id, items: [{ menu_item_id: 1, quantity: 1 }] });
    expect(orderA.status).toBe(201);
    cleanupOrders.push(orderA.body.data.id);

    // Đơn B: Phở bò 70000 x2
    const orderB = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ table_id: tableB.id, items: [{ menu_item_id: 4, quantity: 2 }] });
    expect(orderB.status).toBe(201);
    cleanupOrders.push(orderB.body.data.id);

    // Gộp đơn B vào đơn A
    const mergeRes = await request(app)
      .post(`/api/v1/tables/${tableB.id}/merge`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ target_table_id: tableA.id });
    expect(mergeRes.status).toBe(200);

    // Đơn A phải có 2 món, tổng 55000 + 140000 = 195000
    const detailA = await request(app).get(`/api/v1/orders/${orderA.body.data.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detailA.body.data.items.length).toBe(2);
    expect(parseFloat(detailA.body.data.total_amount)).toBe(195000);

    // Đơn B bị hủy
    const detailB = await request(app).get(`/api/v1/orders/${orderB.body.data.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(detailB.body.data.status).toBe('cancelled');

    // Bàn B được giải phóng
    const tableBAfter = await request(app).get(`/api/v1/tables/${tableB.id}`).set('Authorization', `Bearer ${staffToken}`);
    expect(tableBAfter.body.data.status).toBe('available');
  });

  test('Dashboard stats trả về dữ liệu thật và revenue-chart có hôm nay', async () => {
    const statsRes = await request(app).get('/api/v1/dashboard/stats').set('Authorization', `Bearer ${staffToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.tables.total).toBeGreaterThan(0);
    expect(typeof statsRes.body.data.revenue.today).toBe('number');

    const chartRes = await request(app).get('/api/v1/dashboard/revenue-chart?days=7').set('Authorization', `Bearer ${staffToken}`);
    expect(chartRes.status).toBe(200);
    expect(chartRes.body.data.length).toBe(7);
    // Mỗi ngày đều có key date dạng YYYY-MM-DD
    for (const d of chartRes.body.data) {
      expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
