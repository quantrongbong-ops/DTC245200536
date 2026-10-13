const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.get('/',   authenticate, authorize('admin', 'cashier'), ctrl.getPayments);
router.post('/',  authenticate, authorize('admin', 'cashier', 'staff'), ctrl.createPayment);

module.exports = router;
