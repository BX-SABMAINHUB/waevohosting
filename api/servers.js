// ============================================================
// api/servers.js - Gestión de servidores con JWT
// ============================================================
const axios = require('axios');
const jwt = require('jsonwebtoken');

// ============================================================
// CONFIGURACIÓN (desde variables de entorno)
// ============================================================
const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'Alex27Junio';

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
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Responder a preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // ============================================================
        // VERIFICAR AUTENTICACIÓN
        // ============================================================
        let user;
        try {
            user = verifyToken(req);
        } catch (authError) {
            return res.status(401).json({
                success: false,
                error: 'No autorizado. Token inválido o expirado.'
            });
        }

        // ============================================================
        // OBTENER MÉTODO Y PARÁMETROS
        // ============================================================
        const { method } = req;
        const { id, action } = req.query;
        const serverId = id;

        console.log(`📡 Petición: ${method} /api/servers ${id ? `ID: ${id}` : ''} ${action ? `Acción: ${action}` : ''}`);

        // ============================================================
        // GET /api/servers - Listar todos los servidores
        // ============================================================
        if (method === 'GET' && !serverId) {
            console.log('📋 Listando servidores...');
            
            try {
                const response = await axios.get(
                    `${PTERODACTYL_PANEL_URL}/api/application/servers`,
                    {
                        headers: {
                            'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 15000
                    }
                );

                console.log(`✅ ${response.data.data?.length || 0} servidores encontrados`);
                
                return res.status(200).json({
                    success: true,
                    data: response.data.data || [],
                    meta: response.data.meta || {}
                });
            } catch (apiError) {
                console.error('❌ Error al listar servidores:', apiError.message);
                return res.status(500).json({
                    success: false,
                    error: 'Error al obtener la lista de servidores',
                    details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
                });
            }
        }

        // ============================================================
        // GET /api/servers/:id - Obtener un servidor específico
        // ============================================================
        if (method === 'GET' && serverId) {
            console.log(`🔍 Obteniendo servidor: ${serverId}`);
            
            try {
                const response = await axios.get(
                    `${PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 15000
                    }
                );

                console.log(`✅ Servidor ${serverId} encontrado`);
                
                return res.status(200).json({
                    success: true,
                    data: response.data
                });
            } catch (apiError) {
                console.error(`❌ Error al obtener servidor ${serverId}:`, apiError.message);
                
                if (apiError.response?.status === 404) {
                    return res.status(404).json({
                        success: false,
                        error: `Servidor ${serverId} no encontrado`
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Error al obtener detalles del servidor',
                    details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
                });
            }
        }

        // ============================================================
        // POST /api/servers/:id?action=suspend - Suspender servidor
        // ============================================================
        if (method === 'POST' && serverId && action === 'suspend') {
            console.log(`⏸️ Suspendiendo servidor: ${serverId}`);
            
            try {
                await axios.post(
                    `${PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}/suspend`,
                    {},
                    {
                        headers: {
                            'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 15000
                    }
                );

                console.log(`✅ Servidor ${serverId} suspendido`);
                
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} suspendido correctamente`
                });
            } catch (apiError) {
                console.error(`❌ Error al suspender servidor ${serverId}:`, apiError.message);
                
                if (apiError.response?.status === 404) {
                    return res.status(404).json({
                        success: false,
                        error: `Servidor ${serverId} no encontrado`
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Error al suspender el servidor',
                    details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
                });
            }
        }

        // ============================================================
        // POST /api/servers/:id?action=unsuspend - Reanudar servidor
        // ============================================================
        if (method === 'POST' && serverId && action === 'unsuspend') {
            console.log(`▶️ Reanudando servidor: ${serverId}`);
            
            try {
                await axios.post(
                    `${PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}/unsuspend`,
                    {},
                    {
                        headers: {
                            'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 15000
                    }
                );

                console.log(`✅ Servidor ${serverId} reanudado`);
                
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} reanudado correctamente`
                });
            } catch (apiError) {
                console.error(`❌ Error al reanudar servidor ${serverId}:`, apiError.message);
                
                if (apiError.response?.status === 404) {
                    return res.status(404).json({
                        success: false,
                        error: `Servidor ${serverId} no encontrado`
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Error al reanudar el servidor',
                    details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
                });
            }
        }

        // ============================================================
        // DELETE /api/servers/:id - Eliminar servidor
        // ============================================================
        if (method === 'DELETE' && serverId) {
            console.log(`🗑️ Eliminando servidor: ${serverId}`);
            
            const force = req.query.force === 'true';
            
            try {
                await axios.delete(
                    `${PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}${force ? '?force=true' : ''}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        },
                        timeout: 15000
                    }
                );

                console.log(`✅ Servidor ${serverId} eliminado`);
                
                return res.status(200).json({
                    success: true,
                    message: `Servidor ${serverId} eliminado correctamente`
                });
            } catch (apiError) {
                console.error(`❌ Error al eliminar servidor ${serverId}:`, apiError.message);
                
                if (apiError.response?.status === 404) {
                    return res.status(404).json({
                        success: false,
                        error: `Servidor ${serverId} no encontrado`
                    });
                }
                
                if (apiError.response?.status === 403) {
                    return res.status(403).json({
                        success: false,
                        error: 'No tienes permisos para eliminar este servidor'
                    });
                }
                
                return res.status(500).json({
                    success: false,
                    error: 'Error al eliminar el servidor',
                    details: process.env.NODE_ENV === 'development' ? apiError.message : undefined
                });
            }
        }

        // ============================================================
        // Si no coincide con ninguna ruta
        // ============================================================
        console.log(`❌ Ruta no encontrada: ${method} /api/servers`);
        return res.status(404).json({
            success: false,
            error: 'Ruta no encontrada'
        });

    } catch (error) {
        console.error('❌ Error interno del servidor:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
