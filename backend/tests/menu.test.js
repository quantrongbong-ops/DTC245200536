// ============================================================
// Kiểm thử CRUD món ăn: validation giá, phân quyền, toggle
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');

let adminToken, staffToken, createdItemId;

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
});

describe('MENU /api/v1/menu-items', () => {
  test('GET /menu-items cần đăng nhập', async () => {
    const res = await request(app).get('/api/v1/menu-items');
    expect(res.status).toBe(401);
  });

  test('GET /menu-items trả về danh sách món', async () => {
    const res = await request(app).get('/api/v1/menu-items').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
  });

  test('Tạo món với giá âm → 400', async () => {
    const res = await request(app)
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category_id: 1, name: 'Món test giá âm', price: -1000 });
    expect(res.status).toBe(400);
  });

  test('Tạo món với giá không phải số → 400', async () => {
    const res = await request(app)
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category_id: 1, name: 'Món test giá lỗi', price: 'abc' });
    expect(res.status).toBe(400);
  });

  test('Tạo món hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/v1/menu-items')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ category_id: 1, name: 'Món test Jest', price: 50000, description: 'Món tạo bởi test' });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
    createdItemId = res.body.data.id;
  });

  test('Cập nhật món với tên rỗng → 400', async () => {
    const res = await request(app)
      .put(`/api/v1/menu-items/${createdItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  test('Toggle trạng thái món → 200', async () => {
    const res = await request(app)
      .patch(`/api/v1/menu-items/${createdItemId}/toggle`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_available).toBe(false);
  });

  test('Staff không được xóa món (chỉ admin) → 403', async () => {
    const res = await request(app)
      .delete(`/api/v1/menu-items/${createdItemId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('Admin xóa món → 200', async () => {
    const res = await request(app)
      .delete(`/api/v1/menu-items/${createdItemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});
