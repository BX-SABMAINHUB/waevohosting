// ============================================================
// panel/api/auth.js - Endpoint de autenticación
// ============================================================
// Descripción: Valida credenciales contra Pterodactyl y genera un JWT
// ============================================================

const axios = require('axios');
const jwt = require('jsonwebtoken');

// ============================================================
// CONFIGURACIÓN (desde variables de entorno)
// ============================================================
const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL || 'https://panel.waevohosting.es';
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'tu_clave_secreta_super_segura_cambia_esto';

// ============================================================
// FUNCIÓN PRINCIPAL (Vercel Serverless Function)
// ============================================================
module.exports = async (req, res) => {
    // 1. Solo permitimos peticiones POST
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Método no permitido. Usa POST.'
        });
    }

    // 2. Extraer credenciales del body
    const { email, password } = req.body;

    // 3. Validar que se enviaron email y contraseña
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Faltan credenciales: email y password son obligatorios.'
        });
    }

    // 4. Validar formato básico del email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Formato de email inválido.'
        });
    }

    // 5. Validar que la contraseña no esté vacía
    if (password.length < 4) {
        return res.status(400).json({
            success: false,
            error: 'La contraseña debe tener al menos 4 caracteres.'
        });
    }

    try {
        // 6. Verificar que la API Key está configurada
        if (!PTERODACTYL_API_KEY) {
            console.error('❌ PTERODACTYL_API_KEY no configurada en variables de entorno.');
            return res.status(500).json({
                success: false,
                error: 'Error de configuración del servidor (API Key).'
            });
        }

        // 7. Autenticar contra Pterodactyl
        // NOTA: Pterodactyl no tiene un endpoint de login directo,
        // así que usamos la API de aplicación para buscar al usuario por email.
        console.log(`🔄 Intentando autenticar usuario: ${email}`);

        // 7.1. Buscar usuario por email en Pterodactyl
        const searchResponse = await axios.get(
            `${PTERODACTYL_PANEL_URL}/api/application/users`,
            {
                params: { filter: { email: email } },
                headers: {
                    'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: 10000 // 10 segundos de timeout
            }
        );

        // 7.2. Verificar si el usuario existe
        const users = searchResponse.data.data;
        if (!users || users.length === 0) {
            console.log(`❌ Usuario no encontrado: ${email}`);
            return res.status(401).json({
                success: false,
                error: 'Credenciales incorrectas. Usuario no encontrado.'
            });
        }

        const user = users[0];

        // 7.3. NOTA: No podemos verificar la contraseña directamente desde la API de aplicación.
        // En un entorno real, deberías tener un endpoint de autenticación o usar un hash.
        // Para esta demo, asumimos que si el usuario existe, la autenticación es válida.
        // En producción, deberías implementar una verificación de contraseña adecuada.
        // (Por ejemplo, usando el endpoint de autenticación de Pterodactyl o una base de datos propia).

        // 8. Generar JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                username: user.username,
                rootAdmin: user.root_admin || false,
                timestamp: Date.now()
            },
            JWT_SECRET,
            { expiresIn: '24h' } // Token expira en 24 horas
        );

        // 9. Respuesta exitosa
        console.log(`✅ Login exitoso: ${email} (ID: ${user.id})`);
        res.status(200).json({
            success: true,
            message: 'Login exitoso',
            token: token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                rootAdmin: user.root_admin || false,
                created_at: user.created_at
            }
        });

    } catch (error) {
        // Manejo de errores detallado
        console.error('❌ Error en login:', error);

        // Error específico de conexión
        if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            return res.status(503).json({
                success: false,
                error: 'El panel de Pterodactyl no está accesible. Intenta más tarde.'
            });
        }

        // Error de timeout
        if (error.code === 'ETIMEDOUT') {
            return res.status(504).json({
                success: false,
                error: 'El panel de Pterodactyl no responde. Intenta más tarde.'
            });
        }

        // Error de autenticación de la API Key
        if (error.response && error.response.status === 401) {
            return res.status(500).json({
                success: false,
                error: 'La API Key de Pterodactyl no es válida o ha expirado.'
            });
        }

        // Error genérico de Pterodactyl
        if (error.response && error.response.data) {
            return res.status(error.response.status || 500).json({
                success: false,
                error: error.response.data.errors || 'Error en el panel de Pterodactyl.'
            });
        }

        // Error desconocido
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
