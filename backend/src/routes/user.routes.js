const router = require('express').Router();
const ctrl = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate, authorize('admin'));
router.get('/',       ctrl.getAll);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
