const { Router } = require('express');
const controller = require('../controllers/products.controller');
const { requireAdmin } = require('../middleware/auth');

const router = Router();
const express = require('express');

router.get('/', controller.list);
router.get('/stats', controller.stats);
router.post('/import', requireAdmin, express.raw({ type: () => true, limit: '5mb' }), controller.importFile);
router.post('/', requireAdmin, controller.create);
router.put('/:id', requireAdmin, controller.update);
router.patch('/:id/stock', controller.adjustStock); // vendedores también pueden ajustar stock
router.delete('/:id', requireAdmin, controller.remove);

module.exports = router;
