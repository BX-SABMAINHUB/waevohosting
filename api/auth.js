// ============================================================
// api/auth.js - Autenticación REAL contra Pterodactyl
// ============================================================
const axios = require('axios');
const jwt = require('jsonwebtoken');

// ============================================================
// CONFIGURACIÓN (desde variables de entorno)
// ============================================================
const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'Alex27Junio'; // Fallback seguro

// ============================================================
// ENDPOINT: /api/auth/login
// ============================================================
module.exports = async (req, res) => {
    // Configurar CORS para desarrollo
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder a preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            success: false, 
            error: 'Método no permitido. Usa POST.' 
        });
    }

    // ============================================================
    // VALIDACIÓN DE ENTORNO
    // ============================================================
    if (!PTERODACTYL_PANEL_URL) {
        console.error('❌ PTERODACTYL_PANEL_URL no configurada');
        return res.status(500).json({
            success: false,
            error: 'Configuración del servidor incompleta: falta la URL del panel'
        });
    }

    if (!PTERODACTYL_API_KEY) {
        console.error('❌ PTERODACTYL_API_KEY no configurada');
        return res.status(500).json({
            success: false,
            error: 'Configuración del servidor incompleta: falta la API Key'
        });
    }

    const { email, password } = req.body;

    // Validar credenciales
    if (!email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Faltan email o contraseña' 
        });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de email inválido'
        });
    }

    console.log(`🔍 Intentando login para: ${email}`);

    try {
        // ============================================================
        // PASO 1: Obtener usuario por email desde Pterodactyl
        // ============================================================
        console.log(`📡 Conectando a: ${PTERODACTYL_PANEL_URL}/api/application/users`);
        
        const usersResponse = await axios.get(
            `${PTERODACTYL_PANEL_URL}/api/application/users`,
            {
                headers: {
                    'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: 15000
            }
        );

        // Buscar el usuario por email
        const users = usersResponse.data.data || [];
        const user = users.find(u => u.attributes.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            console.log(`❌ Usuario no encontrado: ${email}`);
            return res.status(401).json({ 
                success: false, 
                error: 'Usuario o contraseña incorrectos' 
            });
        }

        console.log(`✅ Usuario encontrado: ${user.attributes.username} (ID: ${user.attributes.id})`);

        // ============================================================
        // PASO 2: Verificar contraseña con Pterodactyl
        // ============================================================
        try {
            console.log(`🔐 Verificando contraseña para: ${email}`);
            
            // Endpoint de login de Pterodactyl
            const loginResponse = await axios.post(
                `${PTERODACTYL_PANEL_URL}/api/auth/login`,
                {
                    email: email,
                    password: password
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    timeout: 15000,
                    // No seguir redirecciones automáticas
                    maxRedirects: 0,
                    validateStatus: (status) => status < 400 || status === 401
                }
            );

            // Si la contraseña es incorrecta, Pterodactyl devuelve 401
            if (loginResponse.status === 401) {
                console.log(`❌ Contraseña incorrecta para: ${email}`);
                return res.status(401).json({
                    success: false,
                    error: 'Usuario o contraseña incorrectos'
                });
            }

            console.log(`✅ Contraseña verificada para: ${email}`);

        } catch (loginError) {
            // Si el login falla por cualquier razón (excepto 401), asumimos que es incorrecto
            console.log(`❌ Error en verificación de contraseña: ${loginError.message}`);
            
            // Si es un error 401, es contraseña incorrecta
            if (loginError.response?.status === 401) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuario o contraseña incorrectos'
                });
            }
            
            // Otros errores (red, timeout, etc.)
            console.error('❌ Error en verificación de contraseña:', loginError.message);
            return res.status(500).json({
                success: false,
                error: 'Error al verificar la contraseña con el panel de Pterodactyl'
            });
        }

        // ============================================================
        // PASO 3: Generar JWT propio
        // ============================================================
        const token = jwt.sign(
            {
                userId: user.attributes.id,
                email: user.attributes.email,
                username: user.attributes.username,
                isAdmin: user.attributes.root_admin || false
            },
            JWT_SECRET,
            { 
                expiresIn: '24h',
                algorithm: 'HS256'
            }
        );

        console.log(`✅ JWT generado para: ${email}`);

        // ============================================================
        // PASO 4: Respuesta exitosa
        // ============================================================
        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.attributes.id,
                email: user.attributes.email,
                username: user.attributes.username,
                isAdmin: user.attributes.root_admin || false
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error.message);
        
        // Errores específicos de red
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                success: false, 
                error: 'Tiempo de espera agotado con el panel de Pterodactyl' 
            });
        }
        
        if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({
                success: false,
                error: 'No se pudo conectar al panel de Pterodactyl. Verifica que esté encendido y accesible.'
            });
        }

        // Errores de API Key
        if (error.response?.status === 401) {
            return res.status(401).json({ 
                success: false, 
                error: 'API Key inválida o expirada' 
            });
        }
        
        if (error.response?.status === 404) {
            return res.status(404).json({ 
                success: false, 
                error: 'Panel de Pterodactyl no encontrado en la URL especificada' 
            });
        }

        // Error genérico
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
