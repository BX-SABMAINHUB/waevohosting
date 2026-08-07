// api/login.js
const axios = require('axios');
const bcrypt = require('bcryptjs'); // Para comparar la contraseña hasheada

const PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const API_KEY = process.env.PTERODACTYL_API_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  try {
    // 1. Obtener todos los usuarios del panel
    const response = await axios.get(`${PANEL_URL}/api/application/users`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
      }
    });

    const users = response.data.data;
    
    // 2. Buscar el usuario por email
    const user = users.find(u => u.attributes.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 3. Comparar la contraseña (Pterodactyl usa bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.attributes.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // 4. Login exitoso: devolver datos del usuario (sin la contraseña)
    res.status(200).json({
      success: true,
      user: {
        id: user.attributes.id,
        email: user.attributes.email,
        username: user.attributes.username,
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al verificar las credenciales' });
  }
};
