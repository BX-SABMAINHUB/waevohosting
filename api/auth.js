// panel/api/auth.js
// Login para WaevoHosting Panel - Valida contra Pterodactyl via ngrok
import jwt from 'jsonwebtoken';
import axios from 'axios';

// ============================================================
// CONFIGURACIÓN (variables de entorno en Vercel)
// ============================================================
const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERO_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
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

    // Obtener credenciales del body
    const { email, password } = req.body;

    // Validar que no estén vacíos
    if (!email || !password) {
        return res.status(400).json({ error: 'Debes proporcionar email y contraseña' });
    }

    // Log para depuración (se verá en los logs de Vercel)
    console.log(`🔐 Intentando login para: ${email}`);

    try {
        // ============================================================
        // 1. AUTENTICAR CONTRA PTERODACTYL (endpoint /auth/login)
        // ============================================================
        // Cabeceras necesarias para evitar la advertencia de ngrok
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true', // <--- ¡CLAVE!
        };

        // Intentar login contra Pterodactyl
        const loginResponse = await axios.post(`${PTERO_URL}/auth/login`, {
            email: email,
            password: password
        }, {
            headers: headers,
            // Permitir cookies y redirecciones
            withCredentials: true,
            // No seguir redirecciones (para capturar la cookie de sesión)
            maxRedirects: 0,
            validateStatus: (status) => status < 400
        });

        // Si llegamos aquí, el login fue exitoso (Pterodactyl devuelve 200 o 302)
        console.log(`✅ Login exitoso para: ${email}`);

        // Extraer cookies de sesión (si las hay)
        const setCookie = loginResponse.headers['set-cookie'];
        let pterodactylSession = null;
        if (setCookie) {
            pterodactylSession = setCookie.map(c => c.split(';')[0]).join('; ');
            console.log(`🍪 Cookie de sesión obtenida: ${pterodactylSession}`);
        }

        // ============================================================
        // 2. OBTENER DATOS DEL USUARIO DESDE APPLICATION API
        // ============================================================
        const apiHeaders = {
            'Authorization': `Bearer ${PTERO_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true', // <--- ¡CLAVE! También aquí
        };

        const usersResponse = await axios.get(`${PTERO_URL}/api/application/users`, {
            headers: apiHeaders
        });

        // Buscar el usuario por email (coincidencia exacta, sin distinción de mayúsculas)
        const user = usersResponse.data.data.find(u => u.email.toLowerCase() === email.toLowerCase());

        if (!user) {
            console.warn(`⚠️ Usuario ${email} no encontrado en la base de datos de Pterodactyl`);
            return res.status(401).json({ error: 'Usuario no encontrado en el sistema' });
        }

        console.log(`👤 Datos del usuario: ${user.email} (ID: ${user.id})`);

        // ============================================================
        // 3. GENERAR JWT PARA EL PANEL DE WAEVO
        // ============================================================
        const panelToken = jwt.sign(
            {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name || user.username,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                // Guardamos la cookie de sesión para futuras peticiones
                pterodactylSession: pterodactylSession
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // ============================================================
        // 4. RESPONDER CON ÉXITO
        // ============================================================
        res.status(200).json({
            success: true,
            token: panelToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                name: user.name || user.username,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                avatar: user.avatar || null,
                language: user.language || 'en',
                root_admin: user.root_admin || false,
                two_factor: user.two_factor || false
            },
            session: pterodactylSession
        });

    } catch (error) {
        // ============================================================
        // 5. MANEJO DE ERRORES
        // ============================================================

        // Si Pterodactyl devuelve 401 (credenciales incorrectas)
        if (error.response && error.response.status === 401) {
            console.warn(`❌ Credenciales incorrectas para: ${email}`);
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Si la redirección es a /auth/login (fallo de autenticación)
        if (error.response && error.response.status === 302) {
            console.warn(`❌ Redirección a login (credenciales incorrectas) para: ${email}`);
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        // Error de conexión con el panel
        console.error('❌ Error en login:', error.message);
        if (error.response) {
            console.error('📦 Respuesta del panel:', error.response.status, error.response.data);
        }

        res.status(500).json({
            error: 'Error al conectar con el panel de Pterodactyl',
            details: error.message
        });
    }
}
