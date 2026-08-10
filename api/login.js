// api/login.js
const axios = require('axios');

const PANEL_URL = process.env.PTERODACTYL_PANEL_URL;

module.exports = async (req, res) => {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    // ============================================================
    // 1. Autenticar contra el login de Pterodactyl
    // ============================================================
    const loginResponse = await axios.post(
      `${PANEL_URL}/auth/login`,
      {
        email: email,
        password: password,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'ngrok-skip-browser-warning': 'true', // Si usas ngrok
        },
        // No seguir redirecciones para capturar la sesión
        maxRedirects: 0,
        validateStatus: (status) => status < 400,
      }
    );

    // Si llegamos aquí, el login fue exitoso
    // Pterodactyl devuelve una cookie de sesión en los headers
    const cookies = loginResponse.headers['set-cookie'];

    // ============================================================
    // 2. Devolver éxito (y la cookie si es necesario)
    // ============================================================
    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      cookies: cookies, // Opcional: devolver la cookie para el frontend
    });

  } catch (error) {
    // Si Pterodactyl devuelve 302 (redirección) o 401, es que falló
    if (error.response && (error.response.status === 302 || error.response.status === 401)) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    console.error('Error en login:', error.message);
    res.status(500).json({ error: 'Error al verificar las credenciales' });
  }
};
