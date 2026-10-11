const { Router } = require('express');
const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const sales = require('../controllers/sales.controller');
const ops = require('../controllers/ops.controller');
const misc = require('../controllers/misc.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const r = Router();

// Públicas
r.get('/auth/status', auth.status);
r.post('/auth/setup', auth.setup);
r.post('/auth/login', auth.login);
r.post('/auth/logout', auth.logout);

// Con sesión
r.get('/sales', requireAuth, sales.list);
r.post('/sales', requireAuth, sales.create);
r.get('/dashboard', requireAuth, misc.dashboard);
r.get('/movements', requireAuth, misc.listMovements);

r.get('/cash', requireAuth, ops.cashToday);
r.post('/cash/close', requireAuth, ops.cashClose);

// Solo administrador
r.get('/suppliers', requireAdmin, ops.listSuppliers);
r.post('/suppliers', requireAdmin, ops.createSupplier);
r.delete('/suppliers/:id', requireAdmin, ops.removeSupplier);
r.get('/purchases', requireAdmin, ops.listPurchases);
r.post('/purchases', requireAdmin, ops.createPurchase);
r.get('/purchases/suggestions', requireAdmin, ops.suggestions);
r.post('/sales/:id/void', requireAdmin, sales.voidSale);
r.get('/reports/summary', requireAdmin, misc.summary);
r.get('/export/:dataset.:format', requireAdmin, misc.exportData);
r.get('/users', requireAdmin, users.list);
r.post('/users', requireAdmin, users.create);
r.delete('/users/:id', requireAdmin, users.remove);
r.put('/users/:id/password', requireAdmin, users.password);

module.exports = r;
