// ================================================================
//  WAEVOHOSTING ADMIN PANEL - FRONTEND LOGIC
//  Versión 2.0 - Full Stack con Login + Pterodactyl API
// ================================================================

// ================================================================
//  1. CONFIGURACIÓN GLOBAL
// ================================================================
const API_BASE = '/api';
const STORAGE_TOKEN_KEY = 'adminToken';
const STORAGE_USER_KEY = 'adminUser';

// Estado global de la aplicación
const state = {
  servers: [],
  users: [],
  currentPage: 'dashboard',
  selectedServerId: null,
  modalAction: null,
  isLoggedIn: false,
};

// ================================================================
//  2. DOM REFERENCIAS (SELECTORES RÁPIDOS)
// ================================================================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Agrupamos todos los elementos del DOM en un solo objeto
const el = {
  // Login
  loginContainer: $('#loginContainer'),
  loginForm: $('#loginForm'),
  loginEmail: $('#loginEmail'),
  loginPassword: $('#loginPassword'),
  loginError: $('#loginError'),

  // App (Panel)
  appContainer: $('#appContainer'),
  userBadge: $('#userBadge'),
  logoutBtn: $('#logoutBtn'),
  pageTitle: $('#pageTitle'),
  refreshBtn: $('#refreshBtn'),

  // Páginas
  pages: {
    dashboard: $('#dashboardPage'),
    servers: $('#serversPage'),
    users: $('#usersPage'),
    settings: $('#settingsPage'),
  },

  // Estadísticas
  stats: {
    total: $('#totalServers'),
    running: $('#runningServers'),
    suspended: $('#suspendedServers'),
    stopped: $('#stoppedServers'),
  },

  // Servidores
  serversGrid: $('#serversGrid'),
  searchInput: $('#searchServer'),
  newServerBtn: $('#newServerBtn'),

  // Usuarios
  usersTableBody: $('#usersTableBody'),

  // Configuración
  panelUrlInput: $('#panelUrl'),
  testConnectionBtn: $('#testConnectionBtn'),

  // Modal
  modal: $('#actionModal'),
  modalTitle: $('#modalTitle'),
  modalMessage: $('#modalMessage'),
  modalConfirm: $('#modalConfirm'),
  modalCancel: $('#modalCancel'),

  // Gráfico
  statusChart: $('#statusChart'),
};

// ================================================================
//  3. LOGIN / AUTENTICACIÓN
// ================================================================

/**
 * Muestra un mensaje de error en el formulario de login
 */
function showLoginError(message) {
  el.loginError.textContent = '❌ ' + message;
  el.loginError.style.display = 'block';
}

/**
 * Oculta el mensaje de error del login
 */
function hideLoginError() {
  el.loginError.style.display = 'none';
}

/**
 * Maneja el envío del formulario de login
 */
async function handleLoginSubmit(event) {
  event.preventDefault();
  hideLoginError();

  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value.trim();

  if (!email || !password) {
    showLoginError('Por favor, rellena todos los campos.');
    return;
  }

  // Deshabilitar el botón para evitar múltiples envíos
  const submitBtn = el.loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verificando...';

  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (data.success) {
      // Guardar sesión
      sessionStorage.setItem(STORAGE_TOKEN_KEY, data.token);
      sessionStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));

      // Mostrar panel y ocultar login
      el.loginContainer.style.display = 'none';
      el.appContainer.style.display = 'flex';

      // Actualizar información del usuario
      el.userBadge.textContent = data.user.username || 'Admin';

      // Cargar datos iniciales
      await loadDashboard();
      await loadServers();
      await loadUsers();

      // Navegar al dashboard
      navigateTo('dashboard');
    } else {
      showLoginError(data.error || 'Credenciales incorrectas. Inténtalo de nuevo.');
    }
  } catch (error) {
    console.error('Error en login:', error);
    showLoginError('Error al conectar con el servidor. Verifica tu conexión.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Iniciar sesión';
  }
}

/**
 * Cierra la sesión del usuario
 */
function logout() {
  sessionStorage.removeItem(STORAGE_TOKEN_KEY);
  sessionStorage.removeItem(STORAGE_USER_KEY);
  state.isLoggedIn = false;
  el.appContainer.style.display = 'none';
  el.loginContainer.style.display = 'flex';
  el.loginForm.reset();
  hideLoginError();
}

/**
 * Verifica si el usuario ya tiene una sesión activa al cargar la página
 */
function checkExistingSession() {
  const token = sessionStorage.getItem(STORAGE_TOKEN_KEY);
  const userData = sessionStorage.getItem(STORAGE_USER_KEY);

  if (token && userData) {
    try {
      const user = JSON.parse(userData);
      state.isLoggedIn = true;
      el.loginContainer.style.display = 'none';
      el.appContainer.style.display = 'flex';
      el.userBadge.textContent = user.username || 'Admin';

      // Cargar datos del panel
      loadDashboard();
      loadServers();
      loadUsers();
      navigateTo('dashboard');
      return true;
    } catch (e) {
      console.warn('Sesión corrupta, se requiere login:', e);
      sessionStorage.removeItem(STORAGE_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_USER_KEY);
    }
  }
  return false;
}

// ================================================================
//  4. NAVEGACIÓN
// ================================================================

/**
 * Navega a una página específica del panel
 * @param {string} page - Nombre de la página ('dashboard', 'servers', 'users', 'settings')
 */
function navigateTo(page) {
  // Ocultar todas las páginas
  Object.values(el.pages).forEach(p => p.style.display = 'none');

  // Mostrar la página seleccionada
  if (el.pages[page]) {
    el.pages[page].style.display = 'block';
  }

  // Actualizar navegación lateral
  $$('.nav-item').forEach(item => item.classList.remove('active'));
  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  // Actualizar título
  const titles = {
    dashboard: 'Dashboard',
    servers: 'Servidores',
    users: 'Usuarios',
    settings: 'Configuración',
  };
  el.pageTitle.textContent = titles[page] || page;

  state.currentPage = page;

  // Recargar datos según la página
  if (page === 'dashboard') loadDashboard();
  if (page === 'servers') renderServers(state.servers);
  if (page === 'users') renderUsers(state.users);
}

// ================================================================
//  5. DASHBOARD (ESTADÍSTICAS Y GRÁFICOS)
// ================================================================

/**
 * Carga y actualiza los datos del dashboard
 */
async function loadDashboard() {
  try {
    const servers = await fetchServers();
    state.servers = servers;
    const stats = calculateStats(servers);
    updateStats(stats);
    renderChart(stats);
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
    // Mostrar error en el dashboard
    const statsGrid = document.querySelector('.stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = `
        <div class="stat-card" style="grid-column:1/-1;text-align:center;padding:2rem;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">⚠️</div>
          <div style="color:var(--text-secondary);">Error al cargar estadísticas: ${error.message}</div>
        </div>
      `;
    }
  }
}

/**
 * Calcula estadísticas a partir de la lista de servidores
 */
function calculateStats(servers) {
  const running = servers.filter(s => s.attributes.status === 'running').length;
  const suspended = servers.filter(s => s.attributes.status === 'suspended').length;
  const stopped = servers.filter(s => s.attributes.status === 'stopped').length;
  const total = servers.length;

  return { total, running, suspended, stopped };
}

/**
 * Actualiza los números en las tarjetas de estadísticas
 */
function updateStats(stats) {
  el.stats.total.textContent = stats.total;
  el.stats.running.textContent = stats.running;
  el.stats.suspended.textContent = stats.suspended;
  el.stats.stopped.textContent = stats.stopped;
}

/**
 * Renderiza un gráfico de barras con el estado de los servidores
 */
function renderChart(stats) {
  const max = Math.max(stats.total, 1);
  const colors = {
    running: '#34d399',
    suspended: '#fbbf24',
    stopped: '#f87171',
  };

  el.statusChart.innerHTML = '';
  const labels = ['En ejecución', 'Suspendidos', 'Detenidos'];
  const values = [stats.running, stats.suspended, stats.stopped];
  const keys = ['running', 'suspended', 'stopped'];

  const barContainer = document.createElement('div');
  barContainer.className = 'chart-bars';

  keys.forEach((key, index) => {
    const item = document.createElement('div');
    item.className = 'bar-item';

    const bar = document.createElement('div');
    bar.className = 'bar';
    const height = Math.max(20, (values[index] / max) * 150);
    bar.style.height = height + 'px';
    bar.style.background = colors[key];
    bar.style.width = '100%';
    bar.style.maxWidth = '60px';

    // Añadir valor dentro de la barra si es suficientemente grande
    if (values[index] > 0) {
      bar.textContent = values[index];
      bar.style.display = 'flex';
      bar.style.alignItems = 'center';
      bar.style.justifyContent = 'center';
      bar.style.color = '#0b0e14';
      bar.style.fontWeight = '700';
      bar.style.fontSize = '0.8rem';
    }

    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = `${labels[index]}: ${values[index]}`;

    item.appendChild(bar);
    item.appendChild(label);
    barContainer.appendChild(item);
  });

  el.statusChart.appendChild(barContainer);
}

// ================================================================
//  6. SERVIDORES
// ================================================================

/**
 * Obtiene la lista de servidores desde la API
 */
async function fetchServers() {
  const response = await fetch(`${API_BASE}/servers`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener servidores');
  }
  const data = await response.json();
  return data.data || [];
}

/**
 * Carga los servidores desde la API y actualiza la vista
 */
async function loadServers() {
  try {
    const servers = await fetchServers();
    state.servers = servers;
    renderServers(servers);
  } catch (error) {
    console.error('Error al cargar servidores:', error);
    el.serversGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-secondary);">
        ⚠️ Error al cargar servidores: ${error.message}
      </div>
    `;
  }
}

/**
 * Renderiza la lista de servidores en el grid
 */
function renderServers(servers) {
  const searchTerm = el.searchInput.value.toLowerCase().trim();

  const filtered = servers.filter(s =>
    s.attributes.name.toLowerCase().includes(searchTerm) ||
    s.attributes.identifier.toLowerCase().includes(searchTerm)
  );

  if (!filtered.length) {
    el.serversGrid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--text-secondary);">
        ${servers.length === 0 ? 'No hay servidores disponibles.' : 'No se encontraron servidores que coincidan con la búsqueda.'}
      </div>
    `;
    return;
  }

  el.serversGrid.innerHTML = filtered.map(server => {
    const status = server.attributes.status || 'stopped';
    const statusClass = `status-${status}`;
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    return `
      <div class="server-card" data-id="${server.attributes.id}">
        <div class="server-card-header">
          <span class="server-card-name">${server.attributes.name}</span>
          <span class="server-card-status ${statusClass}">${statusLabel}</span>
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.5rem;">
          <strong>Identificador:</strong> ${server.attributes.identifier}
        </div>
        <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:1rem;">
          <strong>Usuario:</strong> ${server.attributes.user || 'N/A'}
        </div>
        <div class="server-card-actions">
          ${status !== 'running' ? `<button class="btn-action success" data-action="start" data-id="${server.attributes.id}">▶ Iniciar</button>` : ''}
          ${status === 'running' ? `<button class="btn-action" data-action="stop" data-id="${server.attributes.id}">⏹ Detener</button>` : ''}
          ${status !== 'suspended' ? `<button class="btn-action" data-action="suspend" data-id="${server.attributes.id}">⏸ Suspender</button>` : ''}
          <button class="btn-action" data-action="reinstall" data-id="${server.attributes.id}">🔄 Reinstalar</button>
          <button class="btn-action danger" data-action="delete" data-id="${server.attributes.id}">🗑 Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  // Añadir event listeners a los botones de acción
  document.querySelectorAll('.server-card-actions .btn-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      handleServerAction(action, id);
    });
  });
}

// ================================================================
//  7. ACCIONES DE SERVIDORES (con confirmación modal)
// ================================================================

/**
 * Maneja las acciones de los servidores (iniciar, detener, suspender, eliminar, reinstalar)
 */
function handleServerAction(action, id) {
  const server = state.servers.find(s => s.attributes.id == id);
  if (!server) {
    console.error('Servidor no encontrado:', id);
    return;
  }

  const actionMap = {
    start: {
      label: 'Iniciar',
      message: `¿Iniciar el servidor "${server.attributes.name}"?`,
      method: 'POST',
      endpoint: `${API_BASE}/server/${id}/start`
    },
    stop: {
      label: 'Detener',
      message: `¿Detener el servidor "${server.attributes.name}"?`,
      method: 'POST',
      endpoint: `${API_BASE}/server/${id}/stop`
    },
    suspend: {
      label: 'Suspender',
      message: `¿Suspender el servidor "${server.attributes.name}"?`,
      method: 'POST',
      endpoint: `${API_BASE}/server/${id}/suspend`
    },
    delete: {
      label: 'Eliminar',
      message: `⚠️ ¿Eliminar permanentemente el servidor "${server.attributes.name}"? Esta acción no se puede deshacer.`,
      method: 'DELETE',
      endpoint: `${API_BASE}/server/${id}/delete`
    },
    reinstall: {
      label: 'Reinstalar',
      message: `⚠️ ¿Reinstalar el servidor "${server.attributes.name}"? Se perderán todos los datos.`,
      method: 'POST',
      endpoint: `${API_BASE}/server/${id}/reinstall`
    },
  };

  const actionInfo = actionMap[action];
  if (!actionInfo) return;

  state.selectedServerId = id;
  state.modalAction = action;

  el.modalTitle.textContent = `${actionInfo.label} servidor`;
  el.modalMessage.textContent = actionInfo.message;
  el.modal.classList.add('active');
}

/**
 * Ejecuta la acción confirmada en el modal
 */
async function executeModalAction() {
  const id = state.selectedServerId;
  const action = state.modalAction;

  if (!id || !action) return;

  // Obtener la información de la acción
  const actionMap = {
    start: { method: 'POST', endpoint: `${API_BASE}/server/${id}/start` },
    stop: { method: 'POST', endpoint: `${API_BASE}/server/${id}/stop` },
    suspend: { method: 'POST', endpoint: `${API_BASE}/server/${id}/suspend` },
    delete: { method: 'DELETE', endpoint: `${API_BASE}/server/${id}/delete` },
    reinstall: { method: 'POST', endpoint: `${API_BASE}/server/${id}/reinstall` },
  };

  const actionInfo = actionMap[action];
  if (!actionInfo) return;

  // Cerrar modal inmediatamente
  closeModal();

  try {
    const response = await fetch(actionInfo.endpoint, { method: actionInfo.method });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Error al ${action} el servidor`);
    }

    // Recargar datos
    await loadServers();
    await loadDashboard();

    // Notificación de éxito (simple)
    showNotification(`✅ Servidor ${action} correctamente`, 'success');
  } catch (error) {
    console.error('Error en acción:', error);
    showNotification(`❌ Error: ${error.message}`, 'error');
  }

  // Limpiar estado
  state.selectedServerId = null;
  state.modalAction = null;
}

/**
 * Cierra el modal de confirmación
 */
function closeModal() {
  el.modal.classList.remove('active');
  state.selectedServerId = null;
  state.modalAction = null;
}

// ================================================================
//  8. USUARIOS
// ================================================================

/**
 * Obtiene la lista de usuarios desde la API
 */
async function fetchUsers() {
  const response = await fetch(`${API_BASE}/users`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener usuarios');
  }
  const data = await response.json();
  return data.data || [];
}

/**
 * Carga los usuarios desde la API y actualiza la vista
 */
async function loadUsers() {
  try {
    const users = await fetchUsers();
    state.users = users;
    renderUsers(users);
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    el.usersTableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-secondary);">
        ⚠️ Error al cargar usuarios: ${error.message}
      </td></tr>
    `;
  }
}

/**
 * Renderiza la tabla de usuarios
 */
function renderUsers(users) {
  if (!users.length) {
    el.usersTableBody.innerHTML = `
      <tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-secondary);">
        No hay usuarios disponibles.
      </td></tr>
    `;
    return;
  }

  el.usersTableBody.innerHTML = users.map(user => `
    <tr>
      <td>${user.attributes.id}</td>
      <td>${user.attributes.username}</td>
      <td>${user.attributes.email}</td>
      <td>${user.attributes.servers_count || 0}</td>
      <td>
        <button class="btn-action" data-user-id="${user.attributes.id}" data-user-email="${user.attributes.email}">
          Ver servidores
        </button>
      </td>
    </tr>
  `).join('');

  // Event listeners para los botones de "Ver servidores"
  document.querySelectorAll('[data-user-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.dataset.userId;
      const userEmail = btn.dataset.userEmail || 'Usuario';
      // Filtrar servidores por usuario (si tienes esa información)
      const userServers = state.servers.filter(s => s.attributes.user_id == userId);
      if (userServers.length) {
        showNotification(`📋 ${userEmail} tiene ${userServers.length} servidor(es)`, 'info');
      } else {
        showNotification(`📋 ${userEmail} no tiene servidores asignados`, 'info');
      }
    });
  });
}

// ================================================================
//  9. NOTIFICACIONES (Sistema simple)
// ================================================================

/**
 * Muestra una notificación temporal en la esquina superior derecha
 */
function showNotification(message, type = 'info') {
  // Eliminar notificaciones existentes
  const oldNotifications = document.querySelectorAll('.notification-toast');
  oldNotifications.forEach(n => n.remove());

  const colors = {
    success: '#34d399',
    error: '#f87171',
    info: '#60a5fa',
    warning: '#fbbf24',
  };

  const toast = document.createElement('div');
  toast.className = 'notification-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--bg-card);
    border: 1px solid ${colors[type] || colors.info};
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    border-radius: 1rem;
    box-shadow: var(--shadow);
    z-index: 9999;
    max-width: 400px;
    font-size: 0.95rem;
    animation: slideIn 0.3s ease;
    backdrop-filter: blur(8px);
  `;

  // Añadir estilo de animación si no existe
  if (!document.getElementById('notification-style')) {
    const style = document.createElement('style');
    style.id = 'notification-style';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  // Auto-cerrar después de 4 segundos
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ================================================================
//  10. CONFIGURACIÓN / PRUEBA DE CONEXIÓN
// ================================================================

/**
 * Prueba la conexión con la API de Pterodactyl
 */
async function testConnection() {
  try {
    el.testConnectionBtn.disabled = true;
    el.testConnectionBtn.textContent = 'Probando...';

    const response = await fetch(`${API_BASE}/servers`);
    if (response.ok) {
      showNotification('✅ Conexión exitosa con la API de Pterodactyl', 'success');
    } else {
      const error = await response.json();
      showNotification(`❌ Error al conectar: ${error.error || 'Error desconocido'}`, 'error');
    }
  } catch (error) {
    showNotification(`❌ Error de conexión: ${error.message}`, 'error');
  } finally {
    el.testConnectionBtn.disabled = false;
    el.testConnectionBtn.textContent = 'Probar conexión';
  }
}

// ================================================================
//  11. EVENT LISTENERS
// ================================================================

// --- Login ---
el.loginForm.addEventListener('submit', handleLoginSubmit);

// --- Logout ---
el.logoutBtn.addEventListener('click', logout);

// --- Navegación ---
$$('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page) navigateTo(page);
  });
});

// --- Refrescar ---
el.refreshBtn.addEventListener('click', () => {
  if (state.currentPage === 'dashboard') loadDashboard();
  else if (state.currentPage === 'servers') loadServers();
  else if (state.currentPage === 'users') loadUsers();
  showNotification('🔄 Datos actualizados', 'info');
});

// --- Búsqueda de servidores ---
el.searchInput.addEventListener('input', () => {
  if (state.currentPage === 'servers') {
    renderServers(state.servers);
  }
});

// --- Nuevo servidor ---
el.newServerBtn.addEventListener('click', () => {
  showNotification('🚧 Función en desarrollo. Usa el panel de Pterodactyl.', 'warning');
});

// --- Probar conexión ---
el.testConnectionBtn.addEventListener('click', testConnection);

// --- Modal ---
el.modalConfirm.addEventListener('click', executeModalAction);
el.modalCancel.addEventListener('click', closeModal);

// Cerrar modal al hacer clic fuera
el.modal.addEventListener('click', (e) => {
  if (e.target === el.modal) closeModal();
});

// --- Cerrar sesión con tecla Escape ---
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && el.modal.classList.contains('active')) {
    closeModal();
  }
});

// ================================================================
//  12. INICIALIZACIÓN DE LA APLICACIÓN
// ================================================================

/**
 * Inicializa la aplicación verificando sesión y cargando datos
 */
function initApp() {
  // Verificar si hay sesión activa
  const hasSession = checkExistingSession();

  // Si no hay sesión, mostrar login
  if (!hasSession) {
    el.loginContainer.style.display = 'flex';
    el.appContainer.style.display = 'none';
  }

  console.log('🚀 WaevoHosting Admin Panel v2.0');
  console.log('📌 Estado:', hasSession ? 'Sesión activa' : 'Esperando login');
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);

// ================================================================
//  13. RECUPERACIÓN DE SESIÓN EN CASO DE ERROR DE RED
// ================================================================

// Si la API falla, mostrar un mensaje amigable
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('fetch') || event.reason?.message?.includes('network')) {
    showNotification('⚠️ Problemas de conexión. Verifica tu red.', 'error');
  }
});

console.log('✅ app.js cargado correctamente');
