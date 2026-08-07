// ============================================================
// API DE SERVIDORES - WaevoHosting
// ============================================================
// Endpoints protegidos por JWT
// ============================================================

const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuración desde variables de entorno
const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'waevohosting_secret_key_change_me';

// Cliente HTTP para Pterodactyl
const pterodactylClient = axios.create({
    baseURL: `${PTERODACTYL_PANEL_URL}/api/application`,
    headers: {
        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// ============================================================
// MIDDLEWARE: Verificación JWT
// ============================================================
const verifyToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Token no proporcionado o inválido');
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        return decoded;
    } catch (error) {
        throw new Error('Token inválido o expirado');
    }
};

// ============================================================
// MANEJADOR PRINCIPAL (Vercel Serverless Function)
// ============================================================
module.exports = async (req, res) => {
    // Configurar CORS para el frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Manejar preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Verificar autenticación (excepto para endpoints públicos si los hubiera)
        const user = verifyToken(req);
        console.log(`🔐 Usuario autenticado: ${user.email} (ID: ${user.id})`);

        // ============================================================
        // RUTAS
        // ============================================================

        // ------------------------------------------------------------
        // GET /api/servers - Listar todos los servidores
        // ------------------------------------------------------------
        if (req.method === 'GET' && req.url === '/servers') {
            try {
                const response = await pterodactylClient.get('/servers');
                return res.status(200).json({
                    success: true,
                    data: response.data.data,
                    meta: response.data.meta
                });
            } catch (error) {
                console.error('❌ Error al listar servidores:', error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al obtener la lista de servidores',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // GET /api/servers/:id - Obtener un servidor específico
        // ------------------------------------------------------------
        const getServerMatch = req.url.match(/^\/servers\/([^\/]+)$/);
        if (req.method === 'GET' && getServerMatch) {
            const serverId = getServerMatch[1];
            try {
                const response = await pterodactylClient.get(`/servers/${serverId}`);
                return res.status(200).json({
                    success: true,
                    data: response.data
                });
            } catch (error) {
                console.error(`❌ Error al obtener servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(404).json({
                    success: false,
                    error: 'Servidor no encontrado',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // POST /api/servers - Crear un nuevo servidor
        // ------------------------------------------------------------
        if (req.method === 'POST' && req.url === '/servers') {
            const {
                name,
                description,
                userId,
                eggId,
                nodeId,
                dockerImage,
                startup,
                environment,
                limits,
                featureLimits
            } = req.body;

            // Validar campos obligatorios
            if (!name || !userId || !eggId || !nodeId) {
                return res.status(400).json({
                    success: false,
                    error: 'Faltan campos obligatorios: name, userId, eggId, nodeId'
                });
            }

            try {
                const response = await pterodactylClient.post('/servers', {
                    name,
                    description: description || '',
                    user: userId,
                    egg: eggId,
                    node: nodeId,
                    docker_image: dockerImage || 'ghcr.io/pterodactyl/yolks:latest',
                    startup: startup || '',
                    environment: environment || {},
                    limits: limits || {
                        memory: 1024,
                        swap: 512,
                        disk: 10240,
                        io: 500,
                        cpu: 100
                    },
                    feature_limits: featureLimits || {
                        databases: 1,
                        allocations: 1,
                        backups: 1
                    }
                });

                return res.status(201).json({
                    success: true,
                    data: response.data,
                    message: 'Servidor creado correctamente'
                });
            } catch (error) {
                console.error('❌ Error al crear servidor:', error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al crear el servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // POST /api/servers/:id/suspend - Suspender un servidor
        // ------------------------------------------------------------
        const suspendMatch = req.url.match(/^\/servers\/([^\/]+)\/suspend$/);
        if (req.method === 'POST' && suspendMatch) {
            const serverId = suspendMatch[1];
            try {
                await pterodactylClient.post(`/servers/${serverId}/suspend`);
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} suspendido correctamente`
                });
            } catch (error) {
                console.error(`❌ Error al suspender servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al suspender el servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // POST /api/servers/:id/unsuspend - Reanudar un servidor
        // ------------------------------------------------------------
        const unsuspendMatch = req.url.match(/^\/servers\/([^\/]+)\/unsuspend$/);
        if (req.method === 'POST' && unsuspendMatch) {
            const serverId = unsuspendMatch[1];
            try {
                await pterodactylClient.post(`/servers/${serverId}/unsuspend`);
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} reanudado correctamente`
                });
            } catch (error) {
                console.error(`❌ Error al reanudar servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al reanudar el servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // POST /api/servers/:id/reinstall - Reinstalar un servidor
        // ------------------------------------------------------------
        const reinstallMatch = req.url.match(/^\/servers\/([^\/]+)\/reinstall$/);
        if (req.method === 'POST' && reinstallMatch) {
            const serverId = reinstallMatch[1];
            try {
                await pterodactylClient.post(`/servers/${serverId}/reinstall`);
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} reinstalado correctamente`
                });
            } catch (error) {
                console.error(`❌ Error al reinstalar servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al reinstalar el servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // DELETE /api/servers/:id - Eliminar un servidor
        // ------------------------------------------------------------
        const deleteMatch = req.url.match(/^\/servers\/([^\/]+)$/);
        if (req.method === 'DELETE' && deleteMatch) {
            const serverId = deleteMatch[1];
            const { force } = req.query;

            try {
                await pterodactylClient.delete(`/servers/${serverId}${force ? '?force=true' : ''}`);
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} eliminado correctamente`
                });
            } catch (error) {
                console.error(`❌ Error al eliminar servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al eliminar el servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // GET /api/servers/:id/status - Obtener estado detallado
        // ------------------------------------------------------------
        const statusMatch = req.url.match(/^\/servers\/([^\/]+)\/status$/);
        if (req.method === 'GET' && statusMatch) {
            const serverId = statusMatch[1];
            try {
                // Obtener detalles del servidor
                const response = await pterodactylClient.get(`/servers/${serverId}`);
                const serverData = response.data;

                // Intentar obtener estado en tiempo real (Client API)
                // Nota: Esto requiere un token de cliente, pero podemos usar el de aplicación para info básica
                return res.status(200).json({
                    success: true,
                    data: {
                        id: serverData.attributes.id,
                        name: serverData.attributes.name,
                        status: serverData.attributes.status || 'unknown',
                        limits: serverData.attributes.limits,
                        usage: serverData.attributes.usage || null,
                        is_suspended: serverData.attributes.is_suspended || false,
                    }
                });
            } catch (error) {
                console.error(`❌ Error al obtener estado del servidor ${serverId}:`, error.response?.data || error.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al obtener estado del servidor',
                    details: error.response?.data?.errors || error.message
                });
            }
        }

        // ------------------------------------------------------------
        // Ruta no encontrada
        // ------------------------------------------------------------
        return res.status(404).json({
            success: false,
            error: 'Endpoint no encontrado',
            path: req.url
        });

    } catch (error) {
        // Error de autenticación
        if (error.message === 'Token no proporcionado o inválido' || error.message === 'Token inválido o expirado') {
            return res.status(401).json({
                success: false,
                error: 'No autorizado',
                message: error.message
            });
        }

        // Error general
        console.error('❌ Error interno del servidor:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};
