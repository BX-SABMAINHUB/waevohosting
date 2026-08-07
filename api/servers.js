// api/servers.js
const { getServers } = require('./_lib/pterodactyl');

module.exports = async (req, res) => {
  // Configurar cabeceras CORS para permitir peticiones desde tu dominio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const servers = await getServers();
    res.status(200).json({ success: true, data: servers });
  } catch (error) {
    console.error('Error al obtener servidores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener los servidores',
      details: error.message
    });
  }
};
