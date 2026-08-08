import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

    const { serverId } = req.query;

    try {
        const response = await axios.get(
            `${process.env.PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );

        const server = response.data.attributes;

        // Obtener logs de la consola (usando Client API)
        const consoleResponse = await axios.get(
            `${process.env.PTERODACTYL_PANEL_URL}/api/client/servers/${serverId}/websocket`,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );

        res.json({
            success: true,
            server: {
                ...server,
                console: consoleResponse.data.data || [],
            }
        });
    } catch (error) {
        console.error('Error al obtener servidor:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al obtener servidor' });
    }
}
