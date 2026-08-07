// ============================================================
// api/servers.js - Gestión de servidores con JWT
// ============================================================
const axios = require('axios');
const jwt = require('jsonwebtoken');

const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// MIDDLEWARE: Verificar JWT
// ============================================================
const verifyToken = (req) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Token no proporcionado o inválido');
    }
    const token = authHeader.split(' ')[1];
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Token inválido o expirado');
    }
};

// ============================================================
// MANEJADOR PRINCIPAL
// ============================================================
module.exports = async (req, res) => {
    try {
        // Verificar autenticación
        const user = verifyToken(req);
        
        // Obtener el método y la ruta
        const { method } = req;
        const { id, action } = req.query;

        // ============================================================
        // GET /api/servers - Listar servidores
        // ============================================================
        if (method === 'GET' && !id) {
            const response = await axios.get(
                `${PTERODACTYL_PANEL_URL}/api/application/servers`,
                {
                    headers: {
                        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000
                }
            );
            
            return res.status(200).json({
                success: true,
                data: response.data.data || [],
                meta: response.data.meta || {}
            });
        }

        // ============================================================
        // GET /api/servers/:id - Obtener un servidor
        // ============================================================
        if (method === 'GET' && id) {
            const response = await axios.get(
                `${PTERODACTYL_PANEL_URL}/api/application/servers/${id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000
                }
            );
            
            return res.status(200).json({
                success: true,
                data: response.data
            });
        }

        // ============================================================
        // POST /api/servers/:id/suspend - Suspender servidor
        // ============================================================
        if (method === 'POST' && id && action === 'suspend') {
            await axios.post(
                `${PTERODACTYL_PANEL_URL}/api/application/servers/${id}/suspend`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000
                }
            );
            
            return res.status(200).json({
                success: true,
                message: `Servidor ${id} suspendido correctamente`
            });
        }

        // ============================================================
        // POST /api/servers/:id/unsuspend - Reanudar servidor
        // ============================================================
        if (method === 'POST' && id && action === 'unsuspend') {
            await axios.post(
                `${PTERODACTYL_PANEL_URL}/api/application/servers/${id}/unsuspend`,
                {},
                {
                    headers: {
                        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000
                }
            );
            
            return res.status(200).json({
                success: true,
                message: `Servidor ${id} reanudado correctamente`
            });
        }

        // ============================================================
        // DELETE /api/servers/:id - Eliminar servidor
        // ============================================================
        if (method === 'DELETE' && id) {
            await axios.delete(
                `${PTERODACTYL_PANEL_URL}/api/application/servers/${id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 10000
                }
            );
            
            return res.status(200).json({
                success: true,
                message: `Servidor ${id} eliminado correctamente`
            });
        }

        // ============================================================
        // Si no coincide con ninguna ruta
        // ============================================================
        return res.status(404).json({
            success: false,
            error: 'Ruta no encontrada'
        });

    } catch (error) {
        console.error('Error en API de servidores:', error.message);
        
        if (error.message === 'Token no proporcionado o inválido' || error.message === 'Token inválido o expirado') {
            return res.status(401).json({ success: false, error: 'No autorizado' });
        }

        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Tiempo de espera agotado con el panel de Pterodactyl' });
        }

        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};
