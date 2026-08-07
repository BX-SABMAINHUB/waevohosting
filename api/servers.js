const express = require('express');
const axios = require('axios');
const router = express.Router();

// ============================================================
// CONFIGURACIÓN DE PTERODACTYL
// ============================================================
const PTERODACTYL_PANEL_URL = 'https://panel.waevohosting.es'; // Cambia por tu URL
const PTERODACTYL_API_KEY = 'ptla_yFNJgW23cSZ99e1vDGujWuEfssG9AZt4Zg975Anu7X6'; // ¡PON AQUÍ TU CLAVE!
// ============================================================

// Cliente HTTP con la configuración base
const pterodactylClient = axios.create({
    baseURL: `${PTERODACTYL_PANEL_URL}/api/application`,
    headers: {
        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// ============================================================
// MIDDLEWARE DE VALIDACIÓN
// ============================================================
const validateServerId = (req, res, next) => {
    const { serverId } = req.params;
    if (!serverId || isNaN(serverId)) {
        return res.status(400).json({
            success: false,
            error: 'ID de servidor inválido o no proporcionado'
        });
    }
    next();
};

// ============================================================
// ENDPOINTS
// ============================================================

// ------------------------------------------------------------
// 1. LISTAR TODOS LOS SERVIDORES
// ------------------------------------------------------------
router.get('/servers', async (req, res) => {
    try {
        const response = await pterodactylClient.get('/servers');
        res.json({
            success: true,
            data: response.data.data,
            meta: response.data.meta
        });
    } catch (error) {
        console.error('Error al listar servidores:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al obtener la lista de servidores'
        });
    }
});

// ------------------------------------------------------------
// 2. OBTENER DETALLES DE UN SERVIDOR
// ------------------------------------------------------------
router.get('/servers/:serverId', validateServerId, async (req, res) => {
    const { serverId } = req.params;
    try {
        const response = await pterodactylClient.get(`/servers/${serverId}`);
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error(`Error al obtener servidor ${serverId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al obtener detalles del servidor'
        });
    }
});

// ------------------------------------------------------------
// 3. CREAR UN NUEVO SERVIDOR (con validaciones)
// ------------------------------------------------------------
router.post('/servers', async (req, res) => {
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

    // Validación básica de campos obligatorios
    if (!name || !userId || !eggId || !nodeId) {
        return res.status(400).json({
            success: false,
            error: 'Faltan campos obligatorios: name, userId, eggId, nodeId'
        });
    }

    try {
        const response = await pterodactylClient.post('/servers', {
            name,
            description,
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

        res.status(201).json({
            success: true,
            data: response.data,
            message: 'Servidor creado correctamente'
        });
    } catch (error) {
        console.error('Error al crear servidor:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al crear el servidor'
        });
    }
});

// ------------------------------------------------------------
// 4. SUSPENDER UN SERVIDOR
// ------------------------------------------------------------
router.post('/servers/:serverId/suspend', validateServerId, async (req, res) => {
    const { serverId } = req.params;
    try {
        await pterodactylClient.post(`/servers/${serverId}/suspend`);
        res.json({
            success: true,
            message: `Servidor ${serverId} suspendido correctamente`
        });
    } catch (error) {
        console.error(`Error al suspender servidor ${serverId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al suspender el servidor'
        });
    }
});

// ------------------------------------------------------------
// 5. REANUDAR UN SERVIDOR
// ------------------------------------------------------------
router.post('/servers/:serverId/unsuspend', validateServerId, async (req, res) => {
    const { serverId } = req.params;
    try {
        await pterodactylClient.post(`/servers/${serverId}/unsuspend`);
        res.json({
            success: true,
            message: `Servidor ${serverId} reanudado correctamente`
        });
    } catch (error) {
        console.error(`Error al reanudar servidor ${serverId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al reanudar el servidor'
        });
    }
});

// ------------------------------------------------------------
// 6. REINSTALAR UN SERVIDOR
// ------------------------------------------------------------
router.post('/servers/:serverId/reinstall', validateServerId, async (req, res) => {
    const { serverId } = req.params;
    try {
        await pterodactylClient.post(`/servers/${serverId}/reinstall`);
        res.json({
            success: true,
            message: `Servidor ${serverId} reinstalado correctamente`
        });
    } catch (error) {
        console.error(`Error al reinstalar servidor ${serverId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al reinstalar el servidor'
        });
    }
});

// ------------------------------------------------------------
// 7. ELIMINAR UN SERVIDOR (con confirmación)
// ------------------------------------------------------------
router.delete('/servers/:serverId', validateServerId, async (req, res) => {
    const { serverId } = req.params;
    const { force } = req.query; // ?force=true para eliminar forzosamente

    try {
        await pterodactylClient.delete(`/servers/${serverId}${force ? '?force=true' : ''}`);
        res.json({
            success: true,
            message: `Servidor ${serverId} eliminado correctamente`
        });
    } catch (error) {
        console.error(`Error al eliminar servidor ${serverId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al eliminar el servidor'
        });
    }
});

// ------------------------------------------------------------
// 8. LISTAR USUARIOS (para asignar servidores)
// ------------------------------------------------------------
router.get('/users', async (req, res) => {
    try {
        const response = await pterodactylClient.get('/users');
        res.json({
            success: true,
            data: response.data.data
        });
    } catch (error) {
        console.error('Error al listar usuarios:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al obtener la lista de usuarios'
        });
    }
});

// ------------------------------------------------------------
// 9. OBTENER ESTADÍSTICAS DEL NODO
// ------------------------------------------------------------
router.get('/nodes/:nodeId', async (req, res) => {
    const { nodeId } = req.params;
    try {
        const response = await pterodactylClient.get(`/nodes/${nodeId}`);
        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        console.error(`Error al obtener nodo ${nodeId}:`, error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: error.response?.data?.errors || 'Error al obtener información del nodo'
        });
    }
});

// ============================================================
// MANEJO DE ERRORES GENERAL
// ============================================================
router.use((err, req, res, next) => {
    console.error('Error no controlado:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: err.message
    });
});

// ============================================================
// EXPORTAR EL ROUTER
// ============================================================
module.exports = router;
