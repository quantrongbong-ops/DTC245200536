const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { login, getMe, changePassword } = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Giới hạn TỐC ĐỘ ĐĂNG NHẬP (chống brute-force): chỉ áp cho /login.
// Trước đây áp cho cả router /auth nên /auth/me (gọi mỗi lần tải trang) và
// /auth/change-password cũng bị tính vào hạn mức 20 lần/15 phút → người dùng
// tải lại trang nhiều lần bị khoá (429) và không đăng nhập được.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau.' },
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

module.exports = router;
