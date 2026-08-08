// ============================================================
// panel/api/index.js - WaevoHosting API UNIFICADA
// ============================================================
// Autor: BX-SABMAINHUB
// Descripción: Un solo archivo para TODAS las funciones serverless
// Versión: 3.0.0
// ============================================================

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

// ============================================================
// 1. CONFIGURACIÓN DE FIREBASE
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyD13N4-9MjTrmlPwGP7mves0Exje4v2ACw",
    authDomain: "kahoot-8529e.firebaseapp.com",
    databaseURL: "https://kahoot-8529e-default-rtdb.firebaseio.com",
    projectId: "kahoot-8529e",
    storageBucket: "kahoot-8529e.firebasestorage.app",
    messagingSenderId: "313414356056",
    appId: "1:313414356056:web:4aab4587f7df9393008e2d",
    measurementId: "G-8T4CPC1BQ3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ============================================================
// 2. CONFIGURACIÓN DE PTERODACTYL (variables de entorno)
// ============================================================
const PTERO_URL = process.env.PTERODACTYL_PANEL_URL;
const PTERO_API_KEY = process.env.PTERODACTYL_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET;

// ============================================================
// 3. HEADERS PREDETERMINADOS PARA PTERODACTYL
// ============================================================
const pteroHeaders = {
    'Authorization': `Bearer ${PTERO_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
};

// ============================================================
// 4. HELPER: OBTENER DATOS DEL USUARIO DESDE PTERODACTYL
// ============================================================
async function getPteroUser(email) {
    try {
        const response = await axios.get(`${PTERO_URL}/api/application/users`, {
            headers: pteroHeaders
        });
        return response.data.data.find(u => u.email.toLowerCase() === email.toLowerCase());
    } catch (error) {
        console.error('Error al obtener usuario de Pterodactyl:', error.message);
        return null;
    }
}

// ============================================================
// 5. HELPER: CREAR USUARIO EN PTERODACTYL
// ============================================================
async function createPteroUser(email, username, password, firstName, lastName) {
    try {
        const response = await axios.post(
            `${PTERO_URL}/api/application/users`,
            {
                email: email,
                username: username || email.split('@')[0],
                first_name: firstName || username || email.split('@')[0],
                last_name: lastName || 'User',
                password: password || Math.random().toString(36).slice(-12),
            },
            { headers: pteroHeaders }
        );
        return response.data.attributes;
    } catch (error) {
        console.error('Error al crear usuario en Pterodactyl:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================
// 6. HELPER: VERIFICAR TOKEN DE FIREBASE (REST API)
// ============================================================
async function verifyFirebaseToken(token) {
    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
            { idToken: token }
        );
        return response.data.users[0];
    } catch (error) {
        console.error('Error al verificar token de Firebase:', error.response?.data || error.message);
        throw error;
    }
}

// ============================================================
// 7. FUNCIÓN PRINCIPAL (HANDLER)
// ============================================================
export default async function handler(req, res) {
    // ============================================================
    // 7.1 CONFIGURACIÓN CORS
    // ============================================================
    res.setHeader('Access-Control-Allow-Origin', 'https://panel.waevohosting.es');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ============================================================
    // 7.2 OBTENER PARÁMETROS
    // ============================================================
    const { path } = req.query;
    const { method } = req;

    console.log(`📡 [${method}] /api/index?path=${path}`);

    // ============================================================
    // 7.3 RUTA: REGISTRO DE USUARIO
    // ============================================================
    if (path === 'register' && method === 'POST') {
        console.log('🔐 Intentando registrar usuario...');
        const { email, password, username, firstName, lastName } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos obligatorios: email y password'
            });
        }

        try {
            // 1. Crear usuario en Firebase
            console.log(`📧 Creando usuario en Firebase: ${email}`);
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // 2. Crear usuario en Pterodactyl
            console.log(`🦕 Creando usuario en Pterodactyl: ${email}`);
            const pteroUser = await createPteroUser(
                email,
                username,
                password,
                firstName,
                lastName
            );

            console.log(`✅ Usuario creado exitosamente: ${email} (ID: ${pteroUser.id})`);

            // 3. Generar token JWT para el panel
            const token = jwt.sign(
                {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username,
                    firebaseUid: firebaseUser.uid
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(201).json({
                success: true,
                message: 'Usuario creado correctamente',
                token: token,
                user: {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username,
                    firstName: pteroUser.first_name,
                    lastName: pteroUser.last_name,
                    firebaseUid: firebaseUser.uid
                }
            });

        } catch (error) {
            console.error('❌ Error en registro:', error.message);
            if (error.code === 'auth/email-already-in-use') {
                return res.status(409).json({
                    success: false,
                    error: 'El correo electrónico ya está registrado'
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Error al crear usuario',
                details: error.message
            });
        }
    }

    // ============================================================
    // 7.4 RUTA: LOGIN CON FIREBASE (email + contraseña)
    // ============================================================
    if (path === 'login' && method === 'POST') {
        console.log('🔐 Intentando login...');
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Faltan email o contraseña'
            });
        }

        try {
            // 1. Autenticar con Firebase
            console.log(`📧 Autenticando en Firebase: ${email}`);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const firebaseUser = userCredential.user;

            // 2. Obtener o crear usuario en Pterodactyl
            console.log(`🦕 Buscando usuario en Pterodactyl: ${email}`);
            let pteroUser = await getPteroUser(email);

            if (!pteroUser) {
                console.log(`👤 Usuario no encontrado en Pterodactyl, creando...`);
                pteroUser = await createPteroUser(
                    email,
                    email.split('@')[0],
                    password,
                    'Usuario',
                    'Firebase'
                );
            }

            console.log(`✅ Login exitoso: ${email} (ID: ${pteroUser.id})`);

            // 3. Generar token JWT
            const token = jwt.sign(
                {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username,
                    firebaseUid: firebaseUser.uid
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.status(200).json({
                success: true,
                message: 'Login exitoso',
                token: token,
                user: {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username,
                    firstName: pteroUser.first_name,
                    lastName: pteroUser.last_name
                }
            });

        } catch (error) {
            console.error('❌ Error en login:', error.message);
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                return res.status(401).json({
                    success: false,
                    error: 'Credenciales incorrectas'
                });
            }
            return res.status(500).json({
                success: false,
                error: 'Error al iniciar sesión',
                details: error.message
            });
        }
    }

    // ============================================================
    // 7.5 RUTA: CREAR SERVIDOR
    // ============================================================
    if (path === 'create-server' && method === 'POST') {
        console.log('🖥️ Creando servidor...');
        const { userId, serviceType, serverName, eggId, nodeId } = req.body;

        if (!userId || !serviceType) {
            return res.status(400).json({
                success: false,
                error: 'Faltan userId o serviceType'
            });
        }

        // IDs de eggs (debes configurarlos según tu panel)
        const EGG_WEB = 1; // Reemplaza con el ID real
        const EGG_BOT = 2; // Reemplaza con el ID real
        const NODE_ID = nodeId || 1; // Reemplaza con el ID real

        const finalEggId = eggId || (serviceType === 'web' ? EGG_WEB : EGG_BOT);

        // Límites según el tipo de servicio
        const limits = {
            memory: serviceType === 'web' ? 1024 : 50, // 1GB para web, 50MB para bot
            swap: 0,
            disk: serviceType === 'web' ? 10240 : 100, // 10GB para web, 100MB para bot
            io: 500,
            cpu: serviceType === 'web' ? 100 : 20, // 100% para web, 20% para bot
        };

        try {
            // 1. Verificar que el usuario no tenga más de 1 servidor
            console.log(`🔍 Verificando servidores existentes para usuario ${userId}`);
            const serversResponse = await axios.get(`${PTERO_URL}/api/application/servers`, {
                headers: pteroHeaders
            });
            const userServers = serversResponse.data.data.filter(
                s => s.attributes.user_id === parseInt(userId)
            );

            if (userServers.length >= 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Ya tienes un servidor activo (máximo 1 por usuario)'
                });
            }

            // 2. Crear servidor en Pterodactyl
            console.log(`🖥️ Creando servidor ${serviceType} para usuario ${userId}`);
            const createResponse = await axios.post(
                `${PTERO_URL}/api/application/servers`,
                {
                    name: serverName || `${serviceType}-server-${userId}`,
                    user: parseInt(userId),
                    egg: finalEggId,
                    node: NODE_ID,
                    docker_image: 'ghcr.io/pterodactyl/yolks:latest',
                    startup: 'echo "Servidor iniciado"',
                    environment: {},
                    limits: limits,
                    feature_limits: {
                        databases: 0,
                        allocations: 1,
                        backups: 0,
                    }
                },
                { headers: pteroHeaders }
            );

            const server = createResponse.data.attributes;
            console.log(`✅ Servidor creado: ${server.id} - ${server.name}`);

            return res.status(201).json({
                success: true,
                message: 'Servidor creado correctamente',
                server: {
                    id: server.id,
                    name: server.name,
                    identifier: server.identifier,
                    status: server.status || 'offline',
                    limits: server.limits,
                    created_at: server.created_at
                }
            });

        } catch (error) {
            console.error('❌ Error al crear servidor:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al crear servidor',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.6 RUTA: ACCIONES DEL SERVIDOR (start, stop, restart, suspend, unsuspend)
    // ============================================================
    if (path === 'server-actions' && method === 'POST') {
        console.log('🔄 Ejecutando acción en servidor...');
        const { serverId, action } = req.body;

        if (!serverId || !action) {
            return res.status(400).json({
                success: false,
                error: 'Faltan serverId o action'
            });
        }

        const validActions = ['start', 'stop', 'restart', 'suspend', 'unsuspend'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                success: false,
                error: `Acción no válida. Debe ser: ${validActions.join(', ')}`
            });
        }

        try {
            console.log(`🔄 Ejecutando ${action} en servidor ${serverId}`);
            await axios.post(
                `${PTERO_URL}/api/application/servers/${serverId}/${action}`,
                {},
                { headers: pteroHeaders }
            );

            console.log(`✅ Acción ${action} completada para servidor ${serverId}`);
            return res.json({
                success: true,
                message: `Servidor ${action} ejecutado correctamente`
            });

        } catch (error) {
            console.error(`❌ Error al ${action} servidor:`, error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: `Error al ${action} servidor`,
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.7 RUTA: OBTENER DETALLES DEL SERVIDOR
    // ============================================================
    if (path === 'server-details' && method === 'GET') {
        console.log('📊 Obteniendo detalles del servidor...');
        const { serverId } = req.query;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                error: 'Falta serverId'
            });
        }

        try {
            console.log(`📊 Obteniendo detalles del servidor ${serverId}`);
            const response = await axios.get(
                `${PTERO_URL}/api/application/servers/${serverId}`,
                { headers: pteroHeaders }
            );

            const server = response.data.attributes;

            // Obtener consola (simulado - en producción usarías WebSocket)
            const consoleData = {
                data: [
                    '📡 Conectado al servidor',
                    '✅ Listo para recibir comandos',
                    `🕒 Última actividad: ${new Date().toISOString()}`
                ]
            };

            console.log(`✅ Detalles obtenidos para servidor ${serverId}`);
            return res.json({
                success: true,
                server: {
                    ...server,
                    console: consoleData.data || [],
                }
            });

        } catch (error) {
            console.error('❌ Error al obtener servidor:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener servidor',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.8 RUTA: OBTENER SERVIDOR DEL USUARIO
    // ============================================================
    if (path === 'user-server' && method === 'GET') {
        console.log('👤 Obteniendo servidor del usuario...');
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'Falta userId'
            });
        }

        try {
            console.log(`👤 Buscando servidor para usuario ${userId}`);
            const response = await axios.get(`${PTERO_URL}/api/application/servers`, {
                headers: pteroHeaders
            });

            const server = response.data.data.find(
                s => s.attributes.user_id === parseInt(userId)
            );

            if (server) {
                console.log(`✅ Servidor encontrado: ${server.attributes.id}`);
                return res.json({
                    success: true,
                    server: server.attributes
                });
            } else {
                console.log(`ℹ️ Usuario ${userId} no tiene servidores`);
                return res.json({
                    success: true,
                    server: null
                });
            }

        } catch (error) {
            console.error('❌ Error al obtener servidor del usuario:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al obtener servidor del usuario',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.9 RUTA: FIREBASE AUTH (para login con Google)
    // ============================================================
    if (path === 'firebase-auth' && method === 'POST') {
        console.log('🔐 Firebase Auth...');
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Falta el token de Firebase'
            });
        }

        try {
            console.log('🔐 Verificando token de Firebase...');
            const userData = await verifyFirebaseToken(token);
            const { email, displayName, localId } = userData;

            console.log(`📧 Firebase login para: ${email}`);

            // Buscar o crear usuario en Pterodactyl
            let pteroUser = await getPteroUser(email);

            if (!pteroUser) {
                console.log(`👤 Usuario no encontrado en Pterodactyl, creando...`);
                pteroUser = await createPteroUser(
                    email,
                    email.split('@')[0],
                    Math.random().toString(36).slice(-12),
                    displayName?.split(' ')[0] || 'Usuario',
                    displayName?.split(' ')[1] || 'Google'
                );
                console.log(`✅ Usuario creado en Pterodactyl: ${pteroUser.id}`);
            }

            // Generar JWT para el panel
            const panelToken = jwt.sign(
                {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username || pteroUser.email.split('@')[0],
                    name: pteroUser.first_name || displayName || pteroUser.email,
                    firebaseUid: localId,
                },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            console.log(`✅ Firebase Auth exitoso para: ${email}`);
            return res.status(200).json({
                success: true,
                token: panelToken,
                user: {
                    id: pteroUser.id,
                    email: pteroUser.email,
                    username: pteroUser.username || pteroUser.email.split('@')[0],
                    name: pteroUser.first_name || displayName || pteroUser.email,
                }
            });

        } catch (error) {
            console.error('❌ Error en Firebase login:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al autenticar con Google',
                details: error.response?.data?.error?.message || error.message
            });
        }
    }

    // ============================================================
    // 7.10 RUTA: ELIMINAR SERVIDOR
    // ============================================================
    if (path === 'delete-server' && method === 'DELETE') {
        console.log('🗑️ Eliminando servidor...');
        const { serverId } = req.query;

        if (!serverId) {
            return res.status(400).json({
                success: false,
                error: 'Falta serverId'
            });
        }

        try {
            console.log(`🗑️ Eliminando servidor ${serverId}`);
            await axios.delete(
                `${PTERO_URL}/api/application/servers/${serverId}`,
                { headers: pteroHeaders }
            );

            console.log(`✅ Servidor ${serverId} eliminado`);
            return res.json({
                success: true,
                message: 'Servidor eliminado correctamente'
            });

        } catch (error) {
            console.error('❌ Error al eliminar servidor:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar servidor',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.11 RUTA: LISTAR TODOS LOS SERVIDORES (solo admin)
    // ============================================================
    if (path === 'servers' && method === 'GET') {
        console.log('📋 Listando todos los servidores...');
        try {
            const response = await axios.get(`${PTERO_URL}/api/application/servers`, {
                headers: pteroHeaders
            });

            console.log(`✅ ${response.data.data.length} servidores encontrados`);
            return res.json({
                success: true,
                servers: response.data.data.map(s => s.attributes)
            });

        } catch (error) {
            console.error('❌ Error al listar servidores:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al listar servidores',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.12 RUTA: LISTAR USUARIOS (solo admin)
    // ============================================================
    if (path === 'users' && method === 'GET') {
        console.log('📋 Listando todos los usuarios...');
        try {
            const response = await axios.get(`${PTERO_URL}/api/application/users`, {
                headers: pteroHeaders
            });

            console.log(`✅ ${response.data.data.length} usuarios encontrados`);
            return res.json({
                success: true,
                users: response.data.data.map(u => u.attributes)
            });

        } catch (error) {
            console.error('❌ Error al listar usuarios:', error.response?.data || error.message);
            return res.status(500).json({
                success: false,
                error: 'Error al listar usuarios',
                details: error.response?.data || error.message
            });
        }
    }

    // ============================================================
    // 7.13 RUTA: HEALTH CHECK (para monitoreo)
    // ============================================================
    if (path === 'health' && method === 'GET') {
        console.log('💚 Health check...');
        try {
            // Verificar conexión con Pterodactyl
            await axios.get(`${PTERO_URL}/api/application/users`, {
                headers: pteroHeaders
            });

            return res.json({
                success: true,
                status: 'OK',
                timestamp: new Date().toISOString(),
                services: {
                    firebase: 'connected',
                    pterodactyl: 'connected',
                }
            });

        } catch (error) {
            console.error('❌ Health check falló:', error.message);
            return res.status(500).json({
                success: false,
                status: 'ERROR',
                timestamp: new Date().toISOString(),
                services: {
                    firebase: 'connected',
                    pterodactyl: 'disconnected',
                },
                error: error.message
            });
        }
    }

    // ============================================================
    // 7.14 404 - RUTA NO ENCONTRADA
    // ============================================================
    console.log(`❌ Ruta no encontrada: /api/index?path=${path}`);
    return res.status(404).json({
        success: false,
        error: 'Endpoint no encontrado',
        path: path,
        method: method
    });
}
