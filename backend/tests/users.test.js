// ============================================================
// Kiểm thử quản lý người dùng: phân quyền admin-only, validation
// ============================================================
const request = require('supertest');
const { app, getAdminToken, getStaffToken } = require('./helpers');
const { pool } = require('../src/config/database');

let adminToken, staffToken;
const testUsername = `testuser_${Date.now()}`;
let createdUserId;

afterAll(async () => {
  try { await pool.query('DELETE FROM users WHERE id=$1', [createdUserId]); } catch {}
});

beforeAll(async () => {
  adminToken = await getAdminToken();
  staffToken = await getStaffToken();
});

describe('USERS /api/v1/users', () => {
  test('Staff không được xem danh sách users → 403', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(403);
  });

  test('Admin xem danh sách users → 200, không lộ password', async () => {
    const res = await request(app).get('/api/v1/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].password).toBeUndefined();
  });

  test('Tạo user với vai trò không hợp lệ → 400', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: testUsername, password: '123456', full_name: 'Test User', role: 'superadmin' });
    expect(res.status).toBe(400);
  });

  test('Tạo user hợp lệ → 201 và đăng nhập được', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: testUsername, password: '123456', full_name: 'Test User', role: 'staff' });
    expect(res.status).toBe(201);
    createdUserId = res.body.data.id;

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: testUsername, password: '123456' });
    expect(loginRes.status).toBe(200);
  });

  test('Tạo user trùng username → 409', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: testUsername, password: '123456', full_name: 'Test User 2' });
    expect(res.status).toBe(409);
  });

  test('Tạo user với email sai định dạng → 400', async () => {
    const res = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: `emailtest_${Date.now()}`, password: '123456', full_name: 'Email Test', role: 'staff', email: 'khong-phai-email' });
    expect(res.status).toBe(400);
  });

  test('Tạo user với email hợp lệ → 201 và đăng nhập được bằng email', async () => {
    const username = `emailok_${Date.now()}`;
    const email = `emailok_${Date.now()}@example.com`;
    const createRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: '123456', full_name: 'Email OK', role: 'admin', email });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.email).toBe(email.toLowerCase());

    // Đăng nhập bằng EMAIL (không dùng username)
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: email.toUpperCase(), password: '123456' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.username).toBe(username);

    // Email trùng → 409
    const dupRes = await request(app)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: `dup_${Date.now()}`, password: '123456', full_name: 'Dup', role: 'staff', email });
    expect(dupRes.status).toBe(409);
  });

  test('Cập nhật user với vai trò không hợp lệ → 400', async () => {
    const res = await request(app)
      .put(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'hacker' });
    expect(res.status).toBe(400);
  });

  test('Xóa user vừa tạo → 200', async () => {
    const res = await request(app)
      .delete(`/api/v1/users/${createdUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    createdUserId = null;
  });
});
