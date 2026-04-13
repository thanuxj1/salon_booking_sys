/* ══════════════════════════════════════════════════════════════════════
   Glamour Salon Admin Dashboard — JavaScript
   Handles: API calls, table rendering, calendar, forms, modals, toasts
   ══════════════════════════════════════════════════════════════════════ */

const API_BASE = 'https://salon-booking-sys.onrender.com/api';

// ── State ─────────────────────────────────────────────────────────────────
let allAppointments = [];
let filteredAppointments = [];
let sortKey   = 'date';
let sortAsc   = true;
let calYear   = new Date().getFullYear();
let calMonth  = new Date().getMonth(); // 0-indexed

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set today as min date for form
  document.getElementById('fDate').min = new Date().toISOString().split('T')[0];
  loadAll();
});

async function loadAll() {
  await fetchAppointments();
  renderStats();
  renderRecentTable();
  renderAllTable();
  renderServicesChart();
  renderCalendar();
}

// ── API ───────────────────────────────────────────────────────────────────
async function fetchAppointments() {
  try {
    const res = await fetch(`${API_BASE}/appointments`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allAppointments = json.data || [];
    filteredAppointments = [...allAppointments];
  } catch (err) {
    console.warn('API not reachable — using demo data.', err.message);
    allAppointments = getDemoData();
    filteredAppointments = [...allAppointments];
    showToast('Using demo data (server not connected)', 'info');
  }
}

async function deleteAppointment(id) {
  if (!confirm('Cancel this appointment?')) return;
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    showToast('Appointment cancelled ✓', 'success');
    closeModal();
    await loadAll();
  } catch {
    showToast('Failed to cancel appointment', 'error');
  }
}

async function markCompleted(id) {
  try {
    const res = await fetch(`${API_BASE}/appointments/${id}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: 'completed' }),
    });
    if (!res.ok) throw new Error();
    showToast('Marked as completed ✓', 'success');
    closeModal();
    await loadAll();
  } catch {
    showToast('Failed to update appointment', 'error');
  }
}

// ── Section Navigation ────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`section-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  
  // Sync bottom nav
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`bnav-${name}`)?.classList.add('active');

  const titles = {
    dashboard:    ['Dashboard',       "Welcome back! Here's today's overview."],
    appointments: ['Appointments',    'Manage all bookings'],
    calendar:     ['Calendar',        'Visual booking calendar'],
    add:          ['New Booking',     'Schedule a new appointment'],
  };
  const [title, sub] = titles[name] || ['Admin', ''];
  document.getElementById('pageTitle').textContent    = title;
  document.getElementById('pageSubtitle').textContent = sub;

  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('mobile-open')) {
    toggleSidebar();
  }

  return false;
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.querySelector('.main-content');
  const overlay = document.getElementById('sidebarOverlay');

  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  } else {
    sidebar.classList.toggle('collapsed');
    main.classList.toggle('full-width');
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────
function toggleTheme() {
  const html  = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeIcon').textContent  = isDark ? '☀️' : '🌙';
  document.getElementById('themeLabel').textContent = isDark ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
}

// Restore saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (savedTheme === 'light') {
    document.getElementById('themeIcon').textContent  = '☀️';
    document.getElementById('themeLabel').textContent = 'Light Mode';
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────
function renderStats() {
  const today = new Date().toISOString().split('T')[0];

  const total     = allAppointments.length;
  const todayAppt = allAppointments.filter(a => {
    const d = a.date ? String(a.date).split('T')[0] : '';
    return d === today && a.status === 'booked';
  }).length;
  const cancelled = allAppointments.filter(a => a.status === 'cancelled').length;

  // Top service
  const serviceCounts = {};
  allAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
    serviceCounts[a.service] = (serviceCounts[a.service] || 0) + 1;
  });
  const topService = Object.entries(serviceCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || '—';

  animateNumber('statTotal',    total);
  animateNumber('statToday',    todayAppt);
  animateNumber('statCancelled', cancelled);
  document.getElementById('statTopService').textContent = topService;
  document.getElementById('appointmentCount').textContent = filteredAppointments.length;
}

function animateNumber(id, target) {
  const el    = document.getElementById(id);
  const start = 0;
  const duration = 600;
  const startTime = performance.now();

  function update(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ── Tables ────────────────────────────────────────────────────────────────
function renderRecentTable() {
  const recent = [...allAppointments]
    .sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 8);
  renderTableRows('recentTableBody', recent, 6);
}

function renderAllTable() {
  const sorted = [...filteredAppointments].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    return sortAsc
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });
  renderTableRows('allTableBody', sorted, 8);
}

function renderTableRows(tbodyId, data, cols) {
  const tbody = document.getElementById(tbodyId);
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="${cols}" class="loading-row">No appointments found.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(a => {
    const initials = (a.name || '?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const dateStr  = a.date ? formatDate(a.date) : '—';
    const timeStr  = a.time ? String(a.time).slice(0,5) : '—';
    const statusBadge = `<span class="status-badge status-${a.status}">${statusEmoji(a.status)} ${a.status}</span>`;

    const customerCell = `
      <div class="customer-cell">
        <div class="avatar">${initials}</div>
        <div>
          <div class="customer-name">${esc(a.name)}</div>
          <div class="customer-phone">${esc(a.phone || '')}</div>
        </div>
      </div>`;

    if (cols === 6) {
      // Recent table (no phone column)
      return `<tr>
        <td>${customerCell}</td>
        <td>${esc(a.service)}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${statusBadge}</td>
        <td><div class="action-btns">
          <button class="action-btn" onclick="viewAppointment(${a.id})" title="View">👁</button>
          ${a.status === 'booked' ? `<button class="action-btn danger" onclick="deleteAppointment(${a.id})" title="Cancel">✕</button>` : ''}
        </div></td>
      </tr>`;
    } else {
      // All table (with phone)
      return `<tr>
        <td style="color:var(--text-muted);font-size:0.8rem">#${a.id}</td>
        <td>${customerCell}</td>
        <td style="font-size:0.82rem">${esc(a.phone || '')}</td>
        <td>${esc(a.service)}</td>
        <td>${dateStr}</td>
        <td>${timeStr}</td>
        <td>${statusBadge}</td>
        <td><div class="action-btns">
          <button class="action-btn" onclick="viewAppointment(${a.id})" title="View">👁</button>
          ${a.status === 'booked' ? `<button class="action-btn" onclick='markCompleted(${a.id})' title="Complete">✅</button>` : ''}
          ${a.status === 'booked' ? `<button class="action-btn danger" onclick="deleteAppointment(${a.id})" title="Cancel">✕</button>` : ''}
        </div></td>
      </tr>`;
    }
  }).join('');
}

function sortTable(key) {
  if (sortKey === key) sortAsc = !sortAsc;
  else { sortKey = key; sortAsc = true; }
  renderAllTable();
}

// ── Services Chart ────────────────────────────────────────────────────────
function renderServicesChart() {
  const counts = {};
  allAppointments.filter(a => a.status !== 'cancelled').forEach(a => {
    counts[a.service] = (counts[a.service] || 0) + 1;
  });

  const sorted   = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const maxCount = sorted[0]?.[1] || 1;
  const container = document.getElementById('servicesChart');

  if (!sorted.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-style:italic;padding:12px 0">No service data yet.</p>';
    return;
  }

  container.innerHTML = sorted.map(([svc, count]) => `
    <div class="service-bar-row">
      <div class="service-bar-label">${svc}</div>
      <div class="service-bar-track">
        <div class="service-bar-fill" style="width:0%" data-width="${(count/maxCount*100).toFixed(0)}%"></div>
      </div>
      <div class="service-bar-count">${count}</div>
    </div>
  `).join('');

  // Animate bars after render
  requestAnimationFrame(() => {
    container.querySelectorAll('.service-bar-fill').forEach(bar => {
      bar.style.width = bar.dataset.width;
    });
  });
}

// ── Calendar ──────────────────────────────────────────────────────────────
function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[calMonth]} ${calYear}`;

  const grid     = document.getElementById('calendarGrid');
  const today    = new Date();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Build lookup: date string → appointments
  const byDate = {};
  allAppointments.forEach(a => {
    const d = a.date ? String(a.date).split('T')[0] : null;
    if (d) { byDate[d] = byDate[d] || []; byDate[d].push(a); }
  });

  const dayHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    .map(d => `<div class="cal-day-header">${d}</div>`).join('');

  const emptyCells = Array(firstDay).fill('<div class="cal-day empty"></div>').join('');

  const dayCells = Array.from({ length: daysInMonth }, (_, i) => {
    const day      = i + 1;
    const dateStr  = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const appts    = byDate[dateStr] || [];
    const isToday  = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

    const dots = appts.slice(0,3).map(a =>
      `<div class="cal-dot ${a.status === 'cancelled' ? 'cancelled' : ''}"></div>`
    ).join('');

    const countLabel = appts.length > 0 ? `<div class="cal-count">${appts.length} appt${appts.length > 1 ? 's' : ''}</div>` : '';

    return `
      <div class="cal-day ${isToday ? 'today' : ''} ${appts.length ? 'has-appts' : ''}"
           onclick="showDayDetail('${dateStr}')">
        <div class="cal-day-num">${day}</div>
        <div class="cal-dot-container">${dots}</div>
        ${countLabel}
      </div>`;
  }).join('');

  grid.innerHTML = dayHeaders + emptyCells + dayCells;
}

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCalendar();
  document.getElementById('dayDetailCard').style.display = 'none';
}

function showDayDetail(dateStr) {
  const appts = allAppointments.filter(a => String(a.date).split('T')[0] === dateStr);
  const card  = document.getElementById('dayDetailCard');
  const title = document.getElementById('dayDetailTitle');
  const content = document.getElementById('dayDetailContent');

  title.textContent = `Appointments for ${formatDate(dateStr)}`;

  if (!appts.length) {
    content.innerHTML = '<p style="padding:20px;color:var(--text-muted);font-style:italic">No appointments this day.</p>';
  } else {
    content.innerHTML = `<div style="padding:16px 24px;display:flex;flex-direction:column;gap:12px">` +
      appts.map(a => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid var(--border)">
          <div>
            <div style="font-weight:600">${esc(a.name)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${esc(a.service)} · ${String(a.time).slice(0,5)}</div>
          </div>
          <span class="status-badge status-${a.status}">${a.status}</span>
        </div>`
      ).join('') + `</div>`;
  }

  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Filters ───────────────────────────────────────────────────────────────
function applyFilters() {
  const date   = document.getElementById('filterDate').value;
  const status = document.getElementById('filterStatus').value;

  filteredAppointments = allAppointments.filter(a => {
    const aDate = a.date ? String(a.date).split('T')[0] : '';
    if (date   && aDate !== date)    return false;
    if (status && a.status !== status) return false;
    return true;
  });

  renderAllTable();
  document.getElementById('appointmentCount').textContent = filteredAppointments.length;
}

function clearFilters() {
  document.getElementById('filterDate').value   = '';
  document.getElementById('filterStatus').value = '';
  filteredAppointments = [...allAppointments];
  renderAllTable();
  document.getElementById('appointmentCount').textContent = filteredAppointments.length;
}

function handleSearch(query) {
  const q = query.toLowerCase().trim();
  filteredAppointments = allAppointments.filter(a =>
    a.name?.toLowerCase().includes(q) ||
    a.phone?.toLowerCase().includes(q) ||
    a.service?.toLowerCase().includes(q)
  );
  renderAllTable();
  document.getElementById('appointmentCount').textContent = filteredAppointments.length;
}

// ── View Modal ────────────────────────────────────────────────────────────
function viewAppointment(id) {
  const a = allAppointments.find(x => x.id === id);
  if (!a) return;

  document.getElementById('modalTitle').textContent = `Appointment #${a.id}`;
  document.getElementById('modalContent').innerHTML = `
    <div class="modal-body">
      <div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">${esc(a.name)}</span></div>
      <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${esc(a.phone || '—')}</span></div>
      <div class="detail-row"><span class="detail-label">Service</span><span class="detail-value">${esc(a.service)}</span></div>
      <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${formatDate(a.date)}</span></div>
      <div class="detail-row"><span class="detail-label">Time</span><span class="detail-value">${String(a.time).slice(0,5)}</span></div>
      <div class="detail-row"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge status-${a.status}">${a.status}</span></span></div>
      ${a.notes ? `<div class="detail-row"><span class="detail-label">Notes</span><span class="detail-value">${esc(a.notes)}</span></div>` : ''}
    </div>
    <div class="modal-actions">
      ${a.status === 'booked' ? `
        <button class="btn-secondary" onclick="markCompleted(${a.id})">✅ Mark Completed</button>
        <button class="btn-danger" onclick="deleteAppointment(${a.id})">✕ Cancel Booking</button>
      ` : ''}
    </div>`;
  openModal();
}

function openModal()  { document.getElementById('modalOverlay').classList.add('open'); }
function closeModal() { document.getElementById('modalOverlay').classList.remove('open'); }

// ── New Booking Form ──────────────────────────────────────────────────────
async function submitBooking(e) {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const msg = document.getElementById('formMessage');
  btn.disabled = true;
  btn.textContent = 'Booking…';
  msg.className = 'form-message';
  msg.textContent = '';

  const payload = {
    name:    document.getElementById('fName').value.trim(),
    phone:   document.getElementById('fPhone').value.trim(),
    service: document.getElementById('fService').value,
    date:    document.getElementById('fDate').value,
    time:    document.getElementById('fTime').value,
    notes:   document.getElementById('fNotes').value.trim(),
  };

  try {
    const res = await fetch(`${API_BASE}/appointments`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    const json = await res.json();

    if (res.ok) {
      msg.className = 'form-message success';
      msg.textContent = `✅ Appointment booked for ${payload.name} on ${formatDate(payload.date)} at ${payload.time}!`;
      e.target.reset();
      showToast('Appointment created ✓', 'success');
      await loadAll();
    } else {
      throw new Error(json.message || json.errors?.[0] || 'Booking failed');
    }
  } catch (err) {
    msg.className = 'form-message error';
    msg.textContent = `❌ ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Book Appointment';
  }
}

// ── Export Excel ──────────────────────────────────────────────────────────
function exportExcel() {
  const btn = document.getElementById('exportBtn');
  btn.textContent = '⏳ Generating…';
  btn.disabled = true;

  const params = new URLSearchParams();
  const date   = document.getElementById('filterDate')?.value;
  const status = document.getElementById('filterStatus')?.value;
  if (date)   params.set('date',   date);
  if (status) params.set('status', status);

  const url = `${API_BASE}/appointments/export?${params}`;

  // Create a hidden link and click it to trigger download
  const a = document.createElement('a');
  a.href = url;
  a.download = 'appointments.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    btn.innerHTML = '<span>📥</span> Export Excel';
    btn.disabled = false;
  }, 2000);

  showToast('Excel export started ✓', 'success');
}

// ── Demo Data (when server is offline) ───────────────────────────────────
function getDemoData() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return [
    { id:1, name:'Sarah Johnson',   phone:'+1234567890', service:'Haircut',          date:today,    time:'09:00', status:'booked',    created_at: new Date().toISOString() },
    { id:2, name:'Emma Williams',   phone:'+1987654321', service:'Facial',            date:today,    time:'11:00', status:'booked',    created_at: new Date().toISOString() },
    { id:3, name:'Maria Garcia',    phone:'+1555123456', service:'Hair Coloring',     date:today,    time:'13:00', status:'completed', created_at: new Date().toISOString() },
    { id:4, name:'Lisa Chen',       phone:'+1444789012', service:'Manicure',          date:tomorrow, time:'10:00', status:'booked',    created_at: new Date().toISOString() },
    { id:5, name:'Anna Brown',      phone:'+1333456789', service:'Eyebrow Threading', date:tomorrow, time:'14:30', status:'booked',    created_at: new Date().toISOString() },
    { id:6, name:'Zoe Taylor',      phone:'+1222333444', service:'Highlights',        date:tomorrow, time:'16:00', status:'cancelled', created_at: new Date().toISOString() },
    { id:7, name:'Sophie Martin',   phone:'+1111222333', service:'Pedicure',          date:today,    time:'15:00', status:'booked',    created_at: new Date().toISOString() },
    { id:8, name:'Olivia Davis',    phone:'+1000111222', service:'Blowout',           date:tomorrow, time:'09:30', status:'booked',    created_at: new Date().toISOString() },
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(String(dateStr).split('T')[0] + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
  } catch { return dateStr; }
}

function statusEmoji(status) {
  return { booked: '🟢', cancelled: '🔴', completed: '🔵' }[status] || '⚪';
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ─────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ── Keyboard Shortcuts ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.ctrlKey && e.key === 'e') { e.preventDefault(); exportExcel(); }
  if (e.ctrlKey && e.key === 'r') { e.preventDefault(); loadAll(); }
});
