// api/auth.js - Endpoint de login para el panel de WaevoHosting
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Configuración desde variables de entorno (Vercel)
const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERO_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    // Configurar CORS para el panel
    res.setHeader('Access-Control-Allow-Origin', 'https://panel.waevohosting.es');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responder a preflight (OPTIONS)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Solo permitir POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan email o contraseña' });
    }

    try {
        // ============================================================
        // 1. Buscar el usuario en Pterodactyl por email
        // ============================================================
        const usersResponse = await axios.get(`${PTERO_URL}/api/application/users`, {
            headers: {
                'Authorization': `Bearer ${PTERO_API_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });

        // Buscar el usuario en la lista
        const user = usersResponse.data.data.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        // ============================================================
        // 2. Autenticar al usuario contra el panel de Pterodactyl
        // ============================================================
        try {
            const authResponse = await axios.post(`${PTERO_URL}/api/authenticate`, {
                email: email,
                password: password
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            });

            // Si la autenticación es exitosa, obtenemos el token de cliente
            const clientToken = authResponse.data.token;

            // ============================================================
            // 3. Generar un JWT para tu panel (expira en 24h)
            // ============================================================
            const panelToken = jwt.sign(
                {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    clientToken: clientToken // Para futuras peticiones a la Client API
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            // ============================================================
            // 4. Responder con el token y datos del usuario
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

        } catch (authError) {
            // Si la autenticación falla (contraseña incorrecta)
            console.error('Error de autenticación:', authError.response?.data || authError.message);
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

    } catch (error) {
        console.error('Error en login:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error al conectar con el panel de Pterodactyl',
            details: error.message
        });
    }
};
