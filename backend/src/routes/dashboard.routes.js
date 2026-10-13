const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/stats',          ctrl.getStats);
router.get('/revenue-chart',  ctrl.getRevenueChart);
router.get('/recent-orders',  ctrl.getRecentOrders);

module.exports = router;
