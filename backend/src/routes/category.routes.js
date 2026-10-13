const router = require('express').Router();
const ctrl = require('../controllers/category.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.get('/',     authenticate, ctrl.getAll);
router.get('/:id',  authenticate, ctrl.getById);
router.post('/',    authenticate, authorize('admin', 'staff'), ctrl.create);
router.put('/:id',  authenticate, authorize('admin', 'staff'), ctrl.update);
router.delete('/:id', authenticate, authorize('admin'), ctrl.remove);

module.exports = router;
