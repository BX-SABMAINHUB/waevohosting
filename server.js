// ============================================================
// SERVIDOR PRINCIPAL - WaevoHosting API
// ============================================================
// Versión: 2.0.0
// Autor: BX-SABMAINHUB
// Descripción: Backend completo para gestionar Pterodactyl
// ============================================================

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 1. MIDDLEWARE DE SEGURIDAD Y RENDIMIENTO
// ============================================================

// Protección de cabeceras HTTP
app.use(helmet({
    contentSecurityPolicy: false, // Desactivamos CSP para permitir iframes de ngrok
    frameguard: false // Permite que la API sea usada desde iframes
}));

// Compresión GZIP para respuestas más rápidas
app.use(compression());

// Logs detallados de peticiones
app.use(morgan('combined', {
    stream: {
        write: (message) => console.log(message.trim())
    }
}));

// CORS - Permite peticiones desde tu web en Vercel
app.use(cors({
    origin: [
        'https://waevohosting.es',
        'https://www.waevohosting.es',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Parseo de JSON y datos URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Limitador de tasa de peticiones (evita ataques de fuerza bruta)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 peticiones por IP
    message: {
        success: false,
        error: 'Demasiadas peticiones desde esta IP, por favor espera 15 minutos'
    }
});
app.use('/api', limiter);

// ============================================================
// 2. CONFIGURACIÓN DE PTERODACTYL (desde .env)
// ============================================================

const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL || 'http://192.168.1.48:8080';
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;

// ============================================================
// 3. IMPORTACIÓN DE ROUTERS
// ============================================================

const serversRouter = require('./api/servers');

// ============================================================
// 4. RUTAS DE LA API
// ============================================================

// Ruta de estado y documentación básica
app.get('/', (req, res) => {
    res.json({
        success: true,
        name: 'WaevoHosting API',
        version: '2.0.0',
        status: 'operational',
        documentation: {
            endpoints: [
                { method: 'GET', path: '/', description: 'Documentación de la API' },
                { method: 'GET', path: '/api/status', description: 'Estado del sistema' },
                { method: 'GET', path: '/api/servers', description: 'Listar todos los servidores' },
                { method: 'GET', path: '/api/servers/:id', description: 'Obtener un servidor' },
                { method: 'POST', path: '/api/servers', description: 'Crear un servidor' },
                { method: 'POST', path: '/api/servers/:id/suspend', description: 'Suspender un servidor' },
                { method: 'POST', path: '/api/servers/:id/unsuspend', description: 'Reanudar un servidor' },
                { method: 'POST', path: '/api/servers/:id/reinstall', description: 'Reinstalar un servidor' },
                { method: 'DELETE', path: '/api/servers/:id', description: 'Eliminar un servidor' },
                { method: 'GET', path: '/api/users', description: 'Listar usuarios' },
                { method: 'GET', path: '/api/nodes/:id', description: 'Obtener un nodo' }
            ]
        },
        server: {
            panel: PTERODACTYL_PANEL_URL,
            time: new Date().toISOString()
        }
    });
});

// Ruta de estado (health check)
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'operational',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        panel: {
            url: PTERODACTYL_PANEL_URL,
            connected: false // Se actualizará con una comprobación real
        }
    });
});

// ============================================================
// 4.1. RUTAS DE SERVIDORES (IMPORTADAS)
// ============================================================

// Montar el router de servidores en /api
app.use('/api', serversRouter);

// ============================================================
// 4.2. RUTA PARA VERIFICAR CONEXIÓN CON PTERODACTYL
// ============================================================

const axios = require('axios');
const pterodactylClient = axios.create({
    baseURL: PTERODACTYL_PANEL_URL,
    headers: {
        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    timeout: 5000 // 5 segundos de timeout
});

app.get('/api/check-panel', async (req, res) => {
    try {
        const response = await pterodactylClient.get('/api/application/users');
        res.json({
            success: true,
            message: 'Panel de Pterodactyl accesible',
            data: response.data
        });
    } catch (error) {
        console.error('Error al conectar con el panel:', error.message);
        res.status(500).json({
            success: false,
            error: 'No se pudo conectar con el panel de Pterodactyl',
            details: error.message
        });
    }
});

// ============================================================
// 5. MANEJO DE ERRORES GLOBAL
// ============================================================

// Middleware para rutas no encontradas (404)
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada',
        path: req.originalUrl
    });
});

// Middleware para errores generales del servidor (500)
app.use((err, req, res, next) => {
    console.error('❌ Error no controlado:', err.stack);
    
    // Responder con un error genérico
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: err.message,
        // Solo mostrar detalles en desarrollo
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// ============================================================
// 6. INICIO DEL SERVIDOR
// ============================================================

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 WaevoHosting API - Servidor iniciado');
    console.log('═══════════════════════════════════════════════');
    console.log(`📡 Puerto:               ${PORT}`);
    console.log(`🔗 Panel Pterodactyl:     ${PTERODACTYL_PANEL_URL}`);
    console.log(`🔑 API Key:              ${PTERODACTYL_API_KEY ? '✅ Configurada' : '❌ No configurada'}`);
    console.log(`🌐 URL local:            http://localhost:${PORT}`);
    console.log(`📡 API:                  http://localhost:${PORT}/api/servers`);
    console.log(`📋 Documentación:        http://localhost:${PORT}/`);
    console.log('═══════════════════════════════════════════════');
    
    // Verificar conexión con Pterodactyl al iniciar
    console.log('🔄 Verificando conexión con el panel...');
    // Se puede implementar una comprobación inicial aquí
});

// ============================================================
// 7. MANEJO DE SEÑALES DE CIERRE
// ============================================================

// Cierre elegante del servidor
process.on('SIGTERM', () => {
    console.log('🛑 Recibida señal SIGTERM, cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Recibida señal SIGINT, cerrando servidor...');
    process.exit(0);
});

// Captura de excepciones no manejadas
process.on('uncaughtException', (error) => {
    console.error('❌ Excepción no capturada:', error);
    // Puedes implementar un sistema de logging aquí
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesa rechazada sin manejar:', reason);
});

// ============================================================
// EXPORTAR APP (para tests o Vercel)
// ============================================================
module.exports = app;
