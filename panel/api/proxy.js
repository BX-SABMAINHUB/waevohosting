// api/proxy.js
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
        // ENVÍA LAS CREDENCIALES A NGROK
        // ============================================================
        const response = await fetch('https://unending-jazz-bush.ngrok-free.dev/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify({ email, password }),
        });

        // Obtener la respuesta como texto (para depuración)
        const text = await response.text();
        console.log('Respuesta de ngrok:', text.substring(0, 200));

        // Intentar parsear como JSON
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Error al parsear JSON:', text);
            return res.status(500).json({
                error: 'El servidor devolvió una respuesta no válida',
                details: text.substring(0, 100),
            });
        }

        // Devolver la respuesta
        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Error en proxy:', error.message);
        return res.status(500).json({
            error: 'Error al conectar con el servidor',
            details: error.message,
        });
    }
}
