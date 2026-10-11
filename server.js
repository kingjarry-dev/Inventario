const app = require('./src/app');
const { PORT } = require('./src/config');

require('./src/services/backup.service').start();

app.listen(PORT, () => {
  console.log(`Inventario listo en http://localhost:${PORT}`);
});
