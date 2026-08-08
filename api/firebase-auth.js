// api/firebase-auth.js - Login con Google via Firebase
import jwt from 'jsonwebtoken';
import axios from 'axios';

// Configuración desde variables de entorno
const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERO_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', 'https://panel.waevohosting.es');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { token } = req.body; // Token de Firebase (Google)
    if (!token) return res.status(400).json({ error: 'Falta el token de Firebase' });

    try {
        // ============================================================
        // 1. VERIFICAR TOKEN DE FIREBASE CON LA REST API
        // ============================================================
        const verifyResponse = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
            { idToken: token }
        );

        const userData = verifyResponse.data.users[0];
        if (!userData) throw new Error('Usuario no encontrado en Firebase');

        const { email, displayName, localId } = userData;
        console.log(`🔐 Firebase login para: ${email}`);

        // ============================================================
        // 2. BUSCAR O CREAR USUARIO EN PTERODACTYL
        // ============================================================
        const headers = {
            'Authorization': `Bearer ${PTERO_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
        };

        // 2a. Buscar usuario por email
        const usersResponse = await axios.get(`${PTERO_URL}/api/application/users`, { headers });
        let user = usersResponse.data.data.find(u => u.email.toLowerCase() === email.toLowerCase());

        // 2b. Si no existe, CREARLO en Pterodactyl
        if (!user) {
            console.log(`👤 Usuario ${email} no encontrado. Creando...`);
            const createResponse = await axios.post(
                `${PTERO_URL}/api/application/users`,
                {
                    email: email,
                    username: email.split('@')[0], // Usa la parte antes del @
                    first_name: displayName?.split(' ')[0] || 'Usuario',
                    last_name: displayName?.split(' ')[1] || 'Google',
                    password: Math.random().toString(36).slice(-12), // Contraseña aleatoria
                },
                { headers }
            );
            user = createResponse.data.attributes || createResponse.data;
            console.log(`✅ Usuario creado en Pterodactyl: ${user.id}`);
        }

        // ============================================================
        // 3. GENERAR JWT PARA EL PANEL
        // ============================================================
        const panelToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                username: user.username || user.email.split('@')[0],
                name: user.first_name || displayName || user.email,
                firebaseUid: localId,
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // ============================================================
        // 4. RESPONDER
        // ============================================================
        res.status(200).json({
            success: true,
            token: panelToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username || user.email.split('@')[0],
                name: user.first_name || displayName || user.email,
            },
        });

    } catch (error) {
        console.error('❌ Error en Firebase login:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Error al autenticar con Google',
            details: error.response?.data?.error?.message || error.message,
        });
    }
}
