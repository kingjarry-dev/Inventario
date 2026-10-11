const express = require('express');
const { PUBLIC_DIR } = require('./config');
const productsRoutes = require('./routes/products.routes');
const indexRoutes = require('./routes/index.routes');
const { attachUser, requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.use('/api', attachUser);
app.use('/api/products', requireAuth, productsRoutes);
app.use('/api', indexRoutes);
app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
