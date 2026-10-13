// ============================================================
// Kiểm thử xác thực: login, me, phân quyền cơ bản
// ============================================================
const request = require('supertest');
const { app, ADMIN_USER, ADMIN_PASS } = require('./helpers');

describe('AUTH /api/v1/auth', () => {
  test('Login thành công với tài khoản seed quantrongbong', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: ADMIN_USER, password: ADMIN_PASS });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
  });

  test('Login sai mật khẩu → 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: ADMIN_USER, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Login thiếu trường → 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ username: ADMIN_USER });
    expect(res.status).toBe(400);
  });

  test('GET /auth/me không có token → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /auth/me với token hợp lệ → 200', async () => {
    const loginRes = await request(app).post('/api/v1/auth/login').send({ username: ADMIN_USER, password: ADMIN_PASS });
    const token = loginRes.body.data.token;
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(ADMIN_USER);
    expect(res.body.data.password).toBeUndefined();
  });

  test('Token không hợp lệ → 401', async () => {
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer invalid-token-xyz');
    expect(res.status).toBe(401);
  });

  test('API bảo vệ yêu cầu đăng nhập: GET /api/v1/orders không token → 401', async () => {
    const res = await request(app).get('/api/v1/orders');
    expect(res.status).toBe(401);
  });
});
