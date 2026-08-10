// api/proxy.js - Proxy para evitar la CSP de ngrok
export default async function handler(req, res) {
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
        // ENVÍA LAS CREDENCIALES A NGROK (Pterodactyl)
        // ============================================================
        const response = await fetch('https://unending-jazz-bush.ngrok-free.dev/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true', // Evita la advertencia de ngrok
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        // Devuelve la misma respuesta que ngrok
        res.status(response.status).json(data);
    } catch (error) {
        console.error('Error en proxy:', error);
        res.status(500).json({ error: 'Error al conectar con el servidor' });
    }
}
