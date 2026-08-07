const express = require('express');
const app = express();
const port = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Importa el router de servidores
const serversRouter = require('./api/servers');
app.use('/api', serversRouter);

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('🚀 API de WaevoHosting funcionando');
});

// Inicia el servidor
app.listen(port, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${port}`);
    console.log(`📡 API en http://localhost:${port}/api/servers`);
});
