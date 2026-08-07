// api/server/[id]/delete.js
const { deleteServer } = require('../../_lib/pterodactyl');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'ID del servidor es requerido' });
  }

  try {
    await deleteServer(id);
    res.status(200).json({ success: true, message: `Servidor ${id} eliminado correctamente` });
  } catch (error) {
    console.error(`Error al eliminar el servidor ${id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar el servidor',
      details: error.message
    });
  }
};
