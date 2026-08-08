import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

    const { serverId, action } = req.body; // action: 'start', 'stop', 'restart'

    try {
        await axios.post(
            `${process.env.PTERODACTYL_PANEL_URL}/api/application/servers/${serverId}/${action}`,
            {},
            {
                headers: {
                    'Authorization': `Bearer ${process.env.PTERODACTYL_API_KEY}`,
                    'ngrok-skip-browser-warning': 'true',
                }
            }
        );

        res.json({
            success: true,
            message: `Servidor ${action} ejecutado correctamente`,
        });
    } catch (error) {
        console.error(`Error al ${action} servidor:`, error.response?.data || error.message);
        res.status(500).json({ error: `Error al ${action} servidor` });
    }
}
