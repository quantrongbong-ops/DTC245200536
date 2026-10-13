const router = require('express').Router();
const ctrl = require('../controllers/table.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.get('/',                  authenticate, ctrl.getAll);
router.get('/:id',               authenticate, ctrl.getById);
router.get('/:id/current-order', authenticate, ctrl.getCurrentOrder);
router.post('/',                 authenticate, authorize('admin'), ctrl.create);
router.put('/:id',               authenticate, authorize('admin'), ctrl.update);
router.patch('/:id/status',      authenticate, ctrl.updateStatus);
router.post('/:id/transfer',         authenticate, ctrl.transferTable);
router.post('/:id/merge',            authenticate, ctrl.mergeTables);
router.delete('/:id',            authenticate, authorize('admin'), ctrl.remove);

module.exports = router;

