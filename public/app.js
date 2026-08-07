// ============================================================
//  WaevoHosting Admin Panel - Frontend Logic
// ============================================================

// Configuración de la API (ajusta según tu despliegue)
const API_BASE = '/api';

// Estado global
let state = {
  servers: [],
  users: [],
  currentPage: 'dashboard',
  selectedServerId: null,
  modalAction: null,
};

// ============================================================
//  DOM References
// ============================================================
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  pages: {
    dashboard: $('#dashboardPage'),
    servers: $('#serversPage'),
    users: $('#usersPage'),
    settings: $('#settingsPage'),
  },
  stats: {
    total: $('#totalServers'),
    running: $('#runningServers'),
    suspended: $('#suspendedServers'),
    stopped: $('#stoppedServers'),
  },
  serversGrid: $('#serversGrid'),
  usersTableBody: $('#usersTableBody'),
  searchInput: $('#searchServer'),
  refreshBtn: $('#refreshBtn'),
  pageTitle: $('#pageTitle'),
  modal: $('#actionModal'),
  modalTitle: $('#modalTitle'),
  modalMessage: $('#modalMessage'),
  modalConfirm: $('#modalConfirm'),
  modalCancel: $('#modalCancel'),
  statusChart: $('#statusChart'),
  newServerBtn: $('#newServerBtn'),
  testConnectionBtn: $('#testConnectionBtn'),
};

// ============================================================
//  Navigation
// ============================================================
function navigateTo(page) {
  // Ocultar todas las páginas
  Object.values(elements.pages).forEach(el => el.style.display = 'none');

  // Mostrar la página seleccionada
  if (elements.pages[page]) {
    elements.pages[page].style.display = 'block';
  }

  // Actualizar navegación
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
  elements.pageTitle.textContent = titles[page] || page;

  state.currentPage = page;

  // Cargar datos según la página
  if (page === 'dashboard') loadDashboard();
  if (page === 'servers') loadServers();
  if (page === 'users') loadUsers();
}

// ============================================================
//  Dashboard
// ============================================================
async function loadDashboard() {
  try {
    const servers = await fetchServers();
    const stats = calculateStats(servers);
    updateStats(stats);
    renderChart(stats);
  } catch (error) {
    console.error('Error al cargar dashboard:', error);
  }
}

function calculateStats(servers) {
  const running = servers.filter(s => s.attributes.status === 'running').length;
  const suspended = servers.filter(s => s.attributes.status === 'suspended').length;
  const stopped = servers.filter(s => s.attributes.status === 'stopped').length;
  const total = servers.length;

  return { total, running, suspended, stopped };
}

function updateStats(stats) {
  elements.stats.total.textContent = stats.total;
  elements.stats.running.textContent = stats.running;
  elements.stats.suspended.textContent = stats.suspended;
  elements.stats.stopped.textContent = stats.stopped;
}

function renderChart(stats) {
  const max = Math.max(stats.total, 1);
  const colors = {
    running: '#34d399',
    suspended: '#fbbf24',
    stopped: '#f87171',
  };

  elements.statusChart.innerHTML = '';
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

    const label = document.createElement('span');
    label.className = 'bar-label';
    label.textContent = `${labels[index]}: ${values[index]}`;

    item.appendChild(bar);
    item.appendChild(label);
    barContainer.appendChild(item);
  });

  elements.statusChart.appendChild(barContainer);
}

// ============================================================
//  Servers
// ============================================================
async function loadServers() {
  try {
    const servers = await fetchServers();
    state.servers = servers;
    renderServers(servers);
  } catch (error) {
    console.error('Error al cargar servidores:', error);
    elements.serversGrid.innerHTML = `<p class="error">Error al cargar servidores: ${error.message}</p>`;
  }
}

function renderServers(servers) {
  if (!servers.length) {
    elements.serversGrid.innerHTML = `<p class="empty-state">No hay servidores disponibles.</p>`;
    return;
  }

  const searchTerm = elements.searchInput.value.toLowerCase();

  const filtered = servers.filter(s =>
    s.attributes.name.toLowerCase().includes(searchTerm) ||
    s.attributes.identifier.toLowerCase().includes(searchTerm)
  );

  elements.serversGrid.innerHTML = filtered.map(server => {
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
    btn.addEventListener('click', (e) => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      handleServerAction(action, id);
    });
  });
}

// ============================================================
//  API Calls
// ============================================================
async function fetchServers() {
  const response = await fetch(`${API_BASE}/servers`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener servidores');
  }
  const data = await response.json();
  return data.data || [];
}

async function fetchUsers() {
  const response = await fetch(`${API_BASE}/users`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al obtener usuarios');
  }
  const data = await response.json();
  return data.data || [];
}

// ============================================================
//  Server Actions
// ============================================================
function handleServerAction(action, id) {
  const server = state.servers.find(s => s.attributes.id == id);
  if (!server) return;

  const actionMap = {
    start: { label: 'Iniciar', message: `¿Iniciar el servidor "${server.attributes.name}"?` },
    stop: { label: 'Detener', message: `¿Detener el servidor "${server.attributes.name}"?` },
    suspend: { label: 'Suspender', message: `¿Suspender el servidor "${server.attributes.name}"?` },
    delete: { label: 'Eliminar', message: `⚠️ ¿Eliminar permanentemente el servidor "${server.attributes.name}"? Esta acción no se puede deshacer.` },
    reinstall: { label: 'Reinstalar', message: `¿Reinstalar el servidor "${server.attributes.name}"? Se perderán todos los datos.` },
  };

  const actionInfo = actionMap[action];
  if (!actionInfo) return;

  state.selectedServerId = id;
  state.modalAction = action;

  elements.modalTitle.textContent = `${actionInfo.label} servidor`;
  elements.modalMessage.textContent = actionInfo.message;
  elements.modal.classList.add('active');
}

// ============================================================
//  Modal
// ============================================================
elements.modalConfirm.addEventListener('click', async () => {
  const id = state.selectedServerId;
  const action = state.modalAction;

  if (!id || !action) return;

  elements.modal.classList.remove('active');

  try {
    const response = await fetch(`${API_BASE}/server/${id}/${action}`, { method: 'POST' });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Error al ${action} el servidor`);
    }

    // Recargar servidores después de la acción
    await loadServers();
    await loadDashboard();

    // Mostrar notificación (simple)
    alert(`✅ Servidor ${action} correctamente`);
  } catch (error) {
    console.error(error);
    alert(`❌ Error: ${error.message}`);
  }

  state.selectedServerId = null;
  state.modalAction = null;
});

elements.modalCancel.addEventListener('click', () => {
  elements.modal.classList.remove('active');
  state.selectedServerId = null;
  state.modalAction = null;
});

// Cerrar modal al hacer clic fuera
elements.modal.addEventListener('click', (e) => {
  if (e.target === elements.modal) {
    elements.modal.classList.remove('active');
    state.selectedServerId = null;
    state.modalAction = null;
  }
});

// ============================================================
//  Users (simplificado)
// ============================================================
async function loadUsers() {
  try {
    const users = await fetchUsers();
    renderUsers(users);
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    elements.usersTableBody.innerHTML = `<tr><td colspan="5">Error al cargar usuarios</td></tr>`;
  }
}

function renderUsers(users) {
  if (!users.length) {
    elements.usersTableBody.innerHTML = `<tr><td colspan="5">No hay usuarios disponibles.</td></tr>`;
    return;
  }

  elements.usersTableBody.innerHTML = users.map(user => `
    <tr>
      <td>${user.attributes.id}</td>
      <td>${user.attributes.username}</td>
      <td>${user.attributes.email}</td>
      <td>${user.attributes.servers_count || 0}</td>
      <td>
        <button class="btn-action" data-user-id="${user.attributes.id}">Ver servidores</button>
      </td>
    </tr>
  `).join('');
}

// ============================================================
//  Event Listeners
// ============================================================
// Navegación
$$('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const page = item.dataset.page;
    if (page) navigateTo(page);
  });
});

// Refrescar
elements.refreshBtn.addEventListener('click', () => {
  if (state.currentPage === 'dashboard') loadDashboard();
  else if (state.currentPage === 'servers') loadServers();
  else if (state.currentPage === 'users') loadUsers();
});

// Búsqueda en servidores
elements.searchInput.addEventListener('input', () => {
  if (state.currentPage === 'servers') {
    renderServers(state.servers);
  }
});

// Nuevo servidor
elements.newServerBtn.addEventListener('click', () => {
  alert('Funcionalidad de creación de servidores en desarrollo.\nUsa el panel de Pterodactyl directamente.');
});

// Probar conexión
elements.testConnectionBtn.addEventListener('click', async () => {
  try {
    const response = await fetch(`${API_BASE}/servers`);
    if (response.ok) {
      alert('✅ Conexión exitosa con la API de Pterodactyl');
    } else {
      alert('❌ Error al conectar con la API');
    }
  } catch (error) {
    alert('❌ Error de conexión: ' + error.message);
  }
});

// ============================================================
//  Init
// ============================================================
navigateTo('dashboard');
