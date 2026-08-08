import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { userId, serviceType, serverName } = req.body; // serviceType: 'web' o 'bot'

    // IDs de eggs y nodos (debes obtenerlos de tu panel)
    const EGG_WEB = 1; // Reemplaza con el ID del egg para Web Hosting
    const EGG_BOT = 2; // Reemplaza con el ID del egg para Bot Hosting
    const NODE_ID = 1; // Reemplaza con el ID de tu nodo

    const eggId = serviceType === 'web' ? EGG_WEB : EGG_BOT;

    // Límites para el plan gratuito
    const limits = {
        memory: serviceType === 'web' ? 1024 : 50, // 1GB para web, 50MB para bot
        swap: 0,
        disk: serviceType === 'web' ? 10240 : 100, // 10GB para web, 100MB para bot
        io: 500,
        cpu: serviceType === 'web' ? 100 : 20, // 100% para web, 20% para bot
    };

    try {
        // 1. Verificar que el usuario no tenga más de 1 servidor
        const serversResponse = await axios.get(
            `${process.env.PTERODACTYL_PANEL_URL}/api/application/servers`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );
        const userServers = serversResponse.data.data.filter(s => s.attributes.user_id === userId);
        if (userServers.length >= 1) {
            return res.status(400).json({ error: 'Ya tienes un servidor activo (máximo 1 por usuario).' });
        }

        // 2. Crear servidor en Pterodactyl
        const createResponse = await axios.post(
            `${process.env.PTERODACTYL_PANEL_URL}/api/application/servers`,
            {
                name: serverName || `${serviceType}-server-${userId}`,
                user: userId,
                egg: eggId,
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
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );

        const server = createResponse.data.attributes;

        res.status(201).json({
            success: true,
            message: 'Servidor creado correctamente',
            server: {
                id: server.id,
                name: server.name,
                identifier: server.identifier,
                status: server.status || 'offline',
                limits: server.limits,
            }
        });
    } catch (error) {
        console.error('Error al crear servidor:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al crear servidor' });
    }
}
