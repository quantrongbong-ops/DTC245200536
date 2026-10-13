// ============================================================
// Helpers dùng chung cho các test file
// ============================================================
const request = require('supertest');
const app = require('../src/app');

// Đăng nhập và trả về token + user
const login = async (username, password) => {
  const res = await request(app).post('/api/v1/auth/login').send({ username, password });
  return res.body.data || null;
};

// Tài khoản admin seed — mật khẩu demo công khai (đồ án), đè được bằng TEST_ADMIN_PASS
const ADMIN_USER = process.env.TEST_ADMIN_USER || 'quantrongbong';
const ADMIN_PASS = process.env.TEST_ADMIN_PASS || 'Trongbong123@';

// Token admin (được seed sẵn)
const getAdminToken = async () => {
  const data = await login(ADMIN_USER, ADMIN_PASS);
  return data ? data.token : null;
};

// Token staff: tự tạo tài khoản staff qua API admin
// (seed sạch chỉ có admin nên test không phụ thuộc tài khoản seed)
const getStaffToken = async () => {
  const adminToken = await getAdminToken();
  const username = `staff_test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  await request(app)
    .post('/api/v1/users')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: 'Test@123456', full_name: 'Test Staff', role: 'staff' });
  const data = await login(username, 'Test@123456');
  return data ? data.token : null;
};

module.exports = { app, login, getAdminToken, getStaffToken, ADMIN_USER, ADMIN_PASS };
