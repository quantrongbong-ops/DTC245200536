const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.get('/',          authenticate, ctrl.getAll);
router.get('/kitchen',   authenticate, ctrl.getKitchenOrders);
router.get('/:id',       authenticate, ctrl.getById);
router.post('/',         authenticate, ctrl.create);
router.post('/:id/items', authenticate, ctrl.addItems);
router.patch('/:id/status', authenticate, ctrl.updateStatus);
router.patch('/items/:id/status', authenticate, ctrl.updateItemStatus);
router.patch('/:id/items/:itemId/status', authenticate, ctrl.updateItemStatus);
router.delete('/:id/items/:itemId', authenticate, ctrl.removeItem);
router.delete('/:id',    authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
