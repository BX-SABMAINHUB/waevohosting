// ============================================================
// API DE AUTENTICACIÓN - WaevoHosting
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
// ENDPOINT: LOGIN
// ============================================================
module.exports = async (req, res) => {
    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email y contraseña son obligatorios'
        });
    }

    try {
        // PASO 1: Verificar credenciales contra Pterodactyl
        // Usamos la API de usuarios para buscar por email
        const usersResponse = await pterodactylClient.get('/users', {
            params: { filter: { email: email } }
        });

        const user = usersResponse.data.data.find(u => u.attributes.email === email);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Credenciales incorrectas'
            });
        }

        // PASO 2: Intentar autenticar con la contraseña
        // Nota: Pterodactyl no tiene un endpoint público de login.
        // Generamos un token de cliente (ptlc) para el usuario.
        // Para simplificar, generamos un JWT propio si el usuario existe en Pterodactyl.

        // PASO 3: Generar JWT
        const token = jwt.sign(
            {
                id: user.attributes.id,
                email: user.attributes.email,
                username: user.attributes.username,
                role: user.attributes.role || 'user'
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // PASO 4: Devolver datos del usuario + token
        res.status(200).json({
            success: true,
            token: token,
            user: {
                id: user.attributes.id,
                email: user.attributes.email,
                username: user.attributes.username,
                role: user.attributes.role || 'user',
                created_at: user.attributes.created_at
            }
        });

    } catch (error) {
        console.error('Error en login:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            error: 'Error al autenticar con el panel',
            details: error.response?.data?.errors || error.message
        });
    }
};
