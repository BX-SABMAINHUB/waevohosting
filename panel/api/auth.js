// panel/api/auth.js
const jwt = require('jsonwebtoken');
const axios = require('axios');

const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERO_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://panel.waevohosting.es');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan email o contraseña' });
    }

    try {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        };

        await axios.post(`${PTERO_URL}/auth/login`, { email, password }, {
            headers,
            withCredentials: true,
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });

        const usersResponse = await axios.get(`${PTERO_URL}/api/application/users`, {
            headers: {
                'Authorization': `Bearer ${PTERO_API_KEY}`,
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            }
        });

        const user = usersResponse.data.data.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email, username: user.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            success: true,
            token: token,
            user: { id: user.id, email: user.email, username: user.username }
        });

    } catch (error) {
        if (error.response && (error.response.status === 401 || error.response.status === 302)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }
        console.error('Error en login:', error.message);
        res.status(500).json({ error: 'Error al conectar con el servidor' });
    }
};
