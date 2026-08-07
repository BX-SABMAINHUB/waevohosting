// api/auth.js - Login que valida contra Pterodactyl
const jwt = require('jsonwebtoken');
const axios = require('axios');

const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    // CORS para el panel
    res.setHeader('Access-Control-Allow-Origin', 'https://panel.waevohosting.es');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan email o contraseña' });
    }

    try {
        // ============================================================
        // 1. Validar contra el login de Pterodactyl
        // ============================================================
        const loginResponse = await axios.post(`${PTERO_URL}/auth/login`, {
            email: email,
            password: password
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            // Permitir cookies y redirecciones
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });

        // Si Pterodactyl responde con éxito (cookies de sesión), el usuario es válido
        // También podemos obtener el token de cliente desde la respuesta
        let clientToken = null;
        let userData = null;

        // Si la respuesta incluye un token de cliente (para API)
        if (loginResponse.data && loginResponse.data.token) {
            clientToken = loginResponse.data.token;
        }

        // Si la respuesta incluye datos del usuario (a veces redirige al dashboard)
        // Podemos obtener el usuario haciendo una petición a /api/application/users
        // con la Application API Key (ya la tenemos en las variables de entorno)

        // ============================================================
        // 2. Obtener datos del usuario desde la Application API
        // ============================================================
        // Usamos la Application API Key para obtener los datos del usuario
        const usersResponse = await axios.get(`${PTERO_URL}/api/application/users`, {
            headers: {
                'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                'Accept': 'application/json',
            }
        });

        const user = usersResponse.data.data.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado en Pterodactyl' });
        }

        // ============================================================
        // 3. Generar JWT para tu panel
        // ============================================================
        const panelToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                username: user.username,
                clientToken: clientToken // Opcional: guardar el token de cliente
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // ============================================================
        // 4. Responder con éxito
        // ============================================================
        res.status(200).json({
            success: true,
            token: panelToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                first_name: user.first_name || '',
                last_name: user.last_name || ''
            }
        });

    } catch (error) {
        // Si la autenticación falla (401 de Pterodactyl)
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        console.error('Error en login:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error al conectar con el panel de Pterodactyl',
            details: error.message
        });
    }
};
