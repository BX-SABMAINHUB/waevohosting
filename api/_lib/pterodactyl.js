// api/_lib/pterodactyl.js
const axios = require('axios');

// Configuración desde variables de entorno (disponibles en Vercel)
const PANEL_URL = process.env.PTERODACTYL_PANEL_URL;
const API_KEY = process.env.PTERODACTYL_API_KEY;

// Cliente base con autenticación
const pteroClient = axios.create({
  baseURL: `${PANEL_URL}/api/application`,
  headers: {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

/**
 * Lista todos los servidores
 */
async function getServers() {
  const response = await pteroClient.get('/servers');
  return response.data.data;
}

/**
 * Obtiene un servidor por ID
 */
async function getServerById(id) {
  const response = await pteroClient.get(`/servers/${id}`);
  return response.data.data;
}

/**
 * Suspende un servidor
 */
async function suspendServer(id) {
  await pteroClient.post(`/servers/${id}/suspend`);
}

/**
 * Inicia un servidor
 */
async function startServer(id) {
  await pteroClient.post(`/servers/${id}/start`);
}

/**
 * Detiene un servidor
 */
async function stopServer(id) {
  await pteroClient.post(`/servers/${id}/stop`);
}

/**
 * Elimina un servidor
 */
async function deleteServer(id) {
  await pteroClient.delete(`/servers/${id}`);
}

/**
 * Reinstala un servidor
 */
async function reinstallServer(id) {
  await pteroClient.post(`/servers/${id}/reinstall`);
}

module.exports = {
  pteroClient,
  getServers,
  getServerById,
  suspendServer,
  startServer,
  stopServer,
  deleteServer,
  reinstallServer,
};
