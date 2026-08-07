// ============================================================
// api/auth.js - Autenticación con Pterodactyl + JWT
// ============================================================
const axios = require('axios');
const jwt = require('jsonwebtoken');

// Configuración desde variables de entorno
const PTERODACTYL_PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERODACTYL_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// ENDPOINT: /api/auth/login
// ============================================================
module.exports = async (req, res) => {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    // Validar que se recibieron credenciales
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Faltan email o contraseña' });
    }

    try {
        // 1. Obtener lista de usuarios de Pterodactyl
        const response = await axios.get(
            `${PTERODACTYL_PANEL_URL}/api/application/users`,
            {
                headers: {
                    'Authorization': `Bearer ${PTERODACTYL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                timeout: 10000 // 10 segundos
            }
        );

        // 2. Buscar el usuario por email
        const users = response.data.data || [];
        const user = users.find(u => u.attributes.email === email);

        if (!user) {
            return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
        }

        // 3. Verificar contraseña (usando la API de Pterodactyl)
        // NOTA: Pterodactyl no tiene un endpoint público para verificar contraseñas.
        // Esta es una simulación: en producción, deberías usar un endpoint de autenticación real.
        // Para este ejemplo, asumimos que si el usuario existe, la contraseña es correcta.
        // En un caso real, necesitarías usar el endpoint de login de Pterodactyl o un sistema de autenticación externo.
        // Por ahora, aceptamos cualquier contraseña si el usuario existe.
        // Esto debe mejorarse en producción.

        // 4. Generar JWT
        const token = jwt.sign(
            {
                userId: user.attributes.id,
                email: user.attributes.email,
                username: user.attributes.username,
                isAdmin: user.attributes.root_admin || false
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // 5. Respuesta exitosa
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
        console.error('Error en login:', error.response?.data || error.message);
        
        // Manejar errores específicos
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Tiempo de espera agotado con el panel de Pterodactyl' });
        }
        if (error.response?.status === 401) {
            return res.status(401).json({ success: false, error: 'API Key inválida' });
        }
        if (error.response?.status === 404) {
            return res.status(404).json({ success: false, error: 'Panel de Pterodactyl no encontrado' });
        }

        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
};
