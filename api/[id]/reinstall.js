// api/server/[id]/reinstall.js
const { reinstallServer } = require('../../_lib/pterodactyl');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID del servidor es requerido' });
  }

  try {
    await reinstallServer(id);
    res.status(200).json({ success: true, message: `Servidor ${id} reinstalado correctamente` });
  } catch (error) {
    console.error(`Error al reinstalar el servidor ${id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error al reinstalar el servidor',
      details: error.message
    });
  }
};
