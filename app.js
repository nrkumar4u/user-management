// ─────────────────────────────────────────────
// DATABASE (localStorage)
// ─────────────────────────────────────────────
var DB = {
  get: function(key) {
    try { return JSON.parse(localStorage.getItem('uf_' + key)) || []; } catch(e) { return []; }
  },
  set: function(key, val) {
    localStorage.setItem('uf_' + key, JSON.stringify(val));
  },
  getObj: function(key, def) {
    def = def || {};
    try { return JSON.parse(localStorage.getItem('uf_' + key)) || def; } catch(e) { return def; }
  },
  setObj: function(key, val) {
    localStorage.setItem('uf_' + key, JSON.stringify(val));
  }
};

function uid() {
  return 'u' + Date.now() + Math.random().toString(36).slice(2, 6);
}

function initDB() {
  if (DB.get('users').length) return;
  var now = new Date().toISOString();
  DB.set('users', [
    { id:'u1', name:'Alex Chen',      email:'superadmin@userforge.io', password:'admin123', role:'super_admin', status:'active', created:now, lastLogin:now },
    { id:'u2', name:'Jordan Kim',     email:'admin@userforge.io',      password:'admin123', role:'admin',       status:'active', created:now, lastLogin:now },
    { id:'u3', name:'Sam Rivera',     email:'manager@userforge.io',    password:'admin123', role:'manager',     status:'active', created:now, lastLogin:now },
    { id:'u4', name:'Taylor Brooks',  email:'t.brooks@company.io',     password:'pass123',  role:'manager',     status:'active', created:now, lastLogin:null },
    { id:'u5', name:'Morgan Lee',     email:'m.lee@company.io',        password:'pass123',  role:'admin',       status:'inactive',created:now, lastLogin:null }
  ]);
  DB.set('logs', []);
}

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
var currentUser = null;
var toastTimer  = null;

// ─────────────────────────────────────────────
// ROLE HELPERS
// ─────────────────────────────────────────────
function roleLabel(r) {
  return { super_admin:'Super Admin', admin:'Admin', manager:'Manager' }[r] || r;
}
function roleBadge(r) {
  var cls = { super_admin:'badge-sa', admin:'badge-admin', manager:'badge-mgr' }[r] || 'badge-mgr';
  return '<span class="' + cls + '">' + roleLabel(r) + '</span>';
}
function roleLevel(r) {
  return { super_admin:3, admin:2, manager:1 }[r] || 0;
}
function canEdit(targetRole) {
  return roleLevel(currentUser.role) > roleLevel(targetRole);
}
function canDelete(targetRole) {
  return roleLevel(currentUser.role) > roleLevel(targetRole);
}
function canAdd() {
  return currentUser.role !== 'manager';
}

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function showToast(msg, type) {
  type = type || 'success';
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.className = ''; }, 3000);
}

// ─────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────
function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
  // wire up any buttons inside modal by id after rendering
  wireModalButtons();
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ─────────────────────────────────────────────
// LOGS
// ─────────────────────────────────────────────
function addLog(action, actor, detail) {
  var logs = DB.get('logs');
  logs.unshift({ id:uid(), action:action, actor:actor, detail:detail, time:new Date().toISOString() });
  DB.set('logs', logs.slice(0, 200));
}

function logHTML(log) {
  var cls = { CREATE:'log-create', UPDATE:'log-update', DELETE:'log-delete', LOGIN:'log-login' }[log.action] || '';
  var t = new Date(log.time).toLocaleString();
  return '<div class="log-item"><div class="log-time">' + t + '</div><div>' +
    '<span class="log-badge ' + cls + '">' + log.action + '</span>' +
    ' <span class="log-actor">' + log.actor + '</span>' +
    ' <span class="log-action">— ' + log.detail + '</span>' +
    '</div></div>';
}

function renderLogs() {
  var q  = (document.getElementById('log-search').value || '').toLowerCase();
  var af = document.getElementById('log-filter').value;
  var logs = DB.get('logs');
  if (q)  logs = logs.filter(function(l) { return l.actor.toLowerCase().indexOf(q) > -1 || l.detail.toLowerCase().indexOf(q) > -1; });
  if (af) logs = logs.filter(function(l) { return l.action === af; });
  var c = document.getElementById('logs-container');
  c.innerHTML = logs.length
    ? logs.map(logHTML).join('')
    : '<div class="empty-state"><div class="icon">📭</div><p>No logs yet</p></div>';
}

function clearLogs() {
  if (!confirm('Clear all audit logs?')) return;
  DB.set('logs', []);
  renderLogs();
  showToast('Logs cleared', 'success');
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
function renderDashboard() {
  var users = DB.get('users');
  var sa = users.filter(function(u){ return u.role === 'super_admin'; }).length;
  var ad = users.filter(function(u){ return u.role === 'admin'; }).length;
  var mg = users.filter(function(u){ return u.role === 'manager'; }).length;
  var ac = users.filter(function(u){ return u.status === 'active'; }).length;
  document.getElementById('stats-grid').innerHTML =
    '<div class="stat-card"><div class="stat-label">Total Users</div><div class="stat-value">' + users.length + '</div><div class="stat-delta">' + ac + ' active</div></div>' +
    '<div class="stat-card"><div class="stat-label">Super Admins</div><div class="stat-value red">' + sa + '</div><div class="stat-delta">Highest access</div></div>' +
    '<div class="stat-card"><div class="stat-label">Admins</div><div class="stat-value blue">' + ad + '</div><div class="stat-delta">Standard admin</div></div>' +
    '<div class="stat-card"><div class="stat-label">Managers</div><div class="stat-value green">' + mg + '</div><div class="stat-delta">Limited access</div></div>';

  var logs = DB.get('logs').slice(0, 6);
  document.getElementById('recent-logs').innerHTML = logs.length
    ? logs.map(logHTML).join('')
    : '<div class="empty-state"><div class="icon">📭</div><p>No activity yet</p></div>';
}

// ─────────────────────────────────────────────
// USERS TABLE
// ─────────────────────────────────────────────
function renderUsersTable() {
  var q  = (document.getElementById('user-search').value || '').toLowerCase();
  var rf = document.getElementById('role-filter').value;
  var sf = document.getElementById('status-filter').value;
  var users = DB.get('users');
  if (q)  users = users.filter(function(u){ return u.name.toLowerCase().indexOf(q) > -1 || u.email.toLowerCase().indexOf(q) > -1; });
  if (rf) users = users.filter(function(u){ return u.role === rf; });
  if (sf) users = users.filter(function(u){ return u.status === sf; });

  var tbody = document.getElementById('users-tbody');
  if (!users.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="icon">🔍</div><p>No users found</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = users.map(function(u) {
    var initials = u.name.split(' ').map(function(w){ return w[0]; }).join('').slice(0,2);
    var canE = canEdit(u.role) && u.id !== currentUser.id;
    var canD = canDelete(u.role) && u.id !== currentUser.id;
    var lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never';
    var editBtn  = canE ? '<button class="btn btn-accent2 btn-sm" data-action="edit" data-id="' + u.id + '">Edit</button>' : '';
    var delBtn   = canD ? '<button class="btn btn-danger btn-sm" data-action="delete" data-id="' + u.id + '">Delete</button>' : '';
    return '<tr>' +
      '<td><div class="user-cell">' +
        '<div class="avatar" style="width:30px;height:30px;font-size:11px;">' + initials + '</div>' +
        '<div><div style="font-weight:500">' + u.name + '</div><div class="mono">' + u.email + '</div></div>' +
      '</div></td>' +
      '<td>' + roleBadge(u.role) + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:7px;"><div class="status-dot ' + u.status + '"></div>' + (u.status === 'active' ? 'Active' : 'Inactive') + '</div></td>' +
      '<td class="mono">' + new Date(u.created).toLocaleDateString() + '</td>' +
      '<td class="mono">' + lastLogin + '</td>' +
      '<td><div class="actions">' +
        '<button class="btn btn-ghost btn-sm" data-action="view" data-id="' + u.id + '">View</button>' +
        editBtn + delBtn +
      '</div></td>' +
    '</tr>';
  }).join('');

  // Wire table action buttons
  tbody.querySelectorAll('[data-action]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      var id = this.getAttribute('data-id');
      if (action === 'view')   viewUser(id);
      if (action === 'edit')   editUser(id);
      if (action === 'delete') deleteUser(id);
    });
  });
}

// ─────────────────────────────────────────────
// VIEW USER
// ─────────────────────────────────────────────
function viewUser(id) {
  var u = DB.get('users').find(function(x){ return x.id === id; });
  if (!u) return;
  showModal(
    '<div class="modal-title">👤 User Details</div>' +
    '<div class="info-row"><span class="info-label">Name</span><span>' + u.name + '</span></div>' +
    '<div class="info-row"><span class="info-label">Email</span><span class="mono">' + u.email + '</span></div>' +
    '<div class="info-row"><span class="info-label">Role</span>' + roleBadge(u.role) + '</div>' +
    '<div class="info-row"><span class="info-label">Status</span><div style="display:flex;align-items:center;gap:7px;"><div class="status-dot ' + u.status + '"></div>' + u.status + '</div></div>' +
    '<div class="info-row"><span class="info-label">Created</span><span class="mono">' + new Date(u.created).toLocaleString() + '</span></div>' +
    '<div class="info-row"><span class="info-label">Last Login</span><span class="mono">' + (u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never') + '</span></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" id="modal-close-action">Close</button></div>'
  );
}

// ─────────────────────────────────────────────
// ADD USER
// ─────────────────────────────────────────────
function openAddUser() {
  if (!canAdd()) { showToast('Insufficient permissions', 'error'); return; }
  var roleOpts = currentUser.role === 'super_admin'
    ? '<option value="super_admin">Super Admin</option><option value="admin">Admin</option><option value="manager">Manager</option>'
    : '<option value="admin">Admin</option><option value="manager">Manager</option>';
  showModal(
    '<div class="modal-title">➕ Add New User</div>' +
    '<div class="field-group"><label>Full Name</label><input id="f-name" placeholder="Jane Doe" /></div>' +
    '<div class="field-group"><label>Email</label><input id="f-email" type="email" placeholder="jane@company.io" /></div>' +
    '<div class="field-group"><label>Password</label><input id="f-pass" type="password" placeholder="••••••••" /></div>' +
    '<div class="field-group"><label>Role</label><select id="f-role">' + roleOpts + '</select></div>' +
    '<div class="field-group"><label>Status</label><select id="f-status"><option value="active">Active</option><option value="inactive">Inactive</option></select></div>' +
    '<div id="form-error" class="error-msg"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" id="modal-cancel-action">Cancel</button>' +
      '<button class="btn btn-primary" id="modal-save-add">Create User</button>' +
    '</div>'
  );
}

function saveNewUser() {
  var name   = document.getElementById('f-name').value.trim();
  var email  = document.getElementById('f-email').value.trim();
  var pass   = document.getElementById('f-pass').value;
  var role   = document.getElementById('f-role').value;
  var status = document.getElementById('f-status').value;
  var errEl  = document.getElementById('form-error');
  if (!name || !email || !pass) { errEl.textContent = 'All fields are required.'; return; }
  var users = DB.get('users');
  if (users.find(function(u){ return u.email === email; })) { errEl.textContent = 'Email already in use.'; return; }
  var newUser = { id:uid(), name:name, email:email, password:pass, role:role, status:status, created:new Date().toISOString(), lastLogin:null };
  users.push(newUser);
  DB.set('users', users);
  addLog('CREATE', currentUser.name, 'Created user ' + name + ' (' + roleLabel(role) + ')');
  closeModal();
  renderUsersTable();
  renderDashboard();
  showToast('✅ ' + name + ' created successfully', 'success');
}

// ─────────────────────────────────────────────
// EDIT USER
// ─────────────────────────────────────────────
function editUser(id) {
  var users = DB.get('users');
  var u = users.find(function(x){ return x.id === id; });
  if (!u || !canEdit(u.role)) { showToast('Permission denied', 'error'); return; }
  var roleOpts = '';
  if (currentUser.role === 'super_admin') {
    roleOpts = '<option value="super_admin"' + (u.role==='super_admin'?' selected':'') + '>Super Admin</option>' +
               '<option value="admin"' + (u.role==='admin'?' selected':'') + '>Admin</option>' +
               '<option value="manager"' + (u.role==='manager'?' selected':'') + '>Manager</option>';
  } else {
    roleOpts = '<option value="admin"' + (u.role==='admin'?' selected':'') + '>Admin</option>' +
               '<option value="manager"' + (u.role==='manager'?' selected':'') + '>Manager</option>';
  }
  showModal(
    '<div class="modal-title">✏️ Edit User</div>' +
    '<div class="field-group"><label>Full Name</label><input id="e-name" value="' + u.name + '" /></div>' +
    '<div class="field-group"><label>Email</label><input id="e-email" type="email" value="' + u.email + '" /></div>' +
    '<div class="field-group"><label>New Password <span style="color:var(--muted);font-size:11px;">(leave blank to keep)</span></label><input id="e-pass" type="password" placeholder="••••••••" /></div>' +
    '<div class="field-group"><label>Role</label><select id="e-role">' + roleOpts + '</select></div>' +
    '<div class="field-group"><label>Status</label><select id="e-status"><option value="active"' + (u.status==='active'?' selected':'') + '>Active</option><option value="inactive"' + (u.status==='inactive'?' selected':'') + '>Inactive</option></select></div>' +
    '<div id="form-error" class="error-msg"></div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" id="modal-cancel-action">Cancel</button>' +
      '<button class="btn btn-primary" id="modal-save-edit" data-id="' + id + '">Save Changes</button>' +
    '</div>'
  );
}

function saveEditUser(id) {
  var users = DB.get('users');
  var idx   = users.findIndex(function(x){ return x.id === id; });
  if (idx === -1) return;
  var name   = document.getElementById('e-name').value.trim();
  var email  = document.getElementById('e-email').value.trim();
  var pass   = document.getElementById('e-pass').value;
  var role   = document.getElementById('e-role').value;
  var status = document.getElementById('e-status').value;
  var errEl  = document.getElementById('form-error');
  if (!name || !email) { errEl.textContent = 'Name and email required.'; return; }
  var conflict = users.find(function(u){ return u.email === email && u.id !== id; });
  if (conflict) { errEl.textContent = 'Email already in use.'; return; }
  var old = users[idx];
  var changes = [];
  if (old.name !== name)     changes.push('name: ' + old.name + '→' + name);
  if (old.role !== role)     changes.push('role: ' + roleLabel(old.role) + '→' + roleLabel(role));
  if (old.status !== status) changes.push('status: ' + old.status + '→' + status);
  users[idx] = Object.assign({}, old, { name:name, email:email, role:role, status:status }, pass ? { password:pass } : {});
  DB.set('users', users);
  addLog('UPDATE', currentUser.name, 'Updated ' + name + (changes.length ? ' (' + changes.join(', ') + ')' : ''));
  closeModal();
  renderUsersTable();
  renderDashboard();
  showToast('✅ ' + name + ' updated', 'success');
}

// ─────────────────────────────────────────────
// DELETE USER
// ─────────────────────────────────────────────
function deleteUser(id) {
  var users = DB.get('users');
  var u = users.find(function(x){ return x.id === id; });
  if (!u || !canDelete(u.role)) { showToast('Permission denied', 'error'); return; }
  if (!confirm('Delete ' + u.name + '? This cannot be undone.')) return;
  DB.set('users', users.filter(function(x){ return x.id !== id; }));
  addLog('DELETE', currentUser.name, 'Deleted user ' + u.name + ' (' + roleLabel(u.role) + ')');
  renderUsersTable();
  renderDashboard();
  showToast('🗑️ ' + u.name + ' deleted', 'success');
}

// ─────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────
var PERMS = [
  ['View all users',              true,  true,  true ],
  ['Create users',                true,  true,  false],
  ['Edit users (lower role)',     true,  true,  false],
  ['Delete users (lower role)',   true,  true,  false],
  ['Assign Super Admin role',     true,  false, false],
  ['Assign Admin role',           true,  true,  false],
  ['Assign Manager role',         true,  true,  false],
  ['View audit logs',             true,  true,  true ],
  ['Clear audit logs',            true,  false, false],
  ['View permissions matrix',     true,  true,  true ],
  ['Manage own profile',          true,  true,  true ]
];

function renderPermissions() {
  document.getElementById('perm-tbody').innerHTML = PERMS.map(function(row) {
    return '<tr><td>' + row[0] + '</td>' +
      '<td>' + (row[1] ? '<span class="check">✓</span>' : '<span class="cross">✕</span>') + '</td>' +
      '<td>' + (row[2] ? '<span class="check">✓</span>' : '<span class="cross">✕</span>') + '</td>' +
      '<td>' + (row[3] ? '<span class="check">✓</span>' : '<span class="cross">✕</span>') + '</td>' +
    '</tr>';
  }).join('');
}

// ─────────────────────────────────────────────
// NAVIGATION
// ─────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(n){ n.classList.remove('active'); });
  var page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');
  var navItem = document.querySelector('[data-page="' + name + '"]');
  if (navItem) navItem.classList.add('active');
  if (name === 'users')       renderUsersTable();
  if (name === 'logs')        renderLogs();
  if (name === 'permissions') renderPermissions();
  if (name === 'dashboard')   renderDashboard();
}

// ─────────────────────────────────────────────
// WIRE MODAL BUTTONS (called after showModal)
// ─────────────────────────────────────────────
function wireModalButtons() {
  var closeAction = document.getElementById('modal-close-action');
  if (closeAction) closeAction.addEventListener('click', closeModal);

  var cancelAction = document.getElementById('modal-cancel-action');
  if (cancelAction) cancelAction.addEventListener('click', closeModal);

  var saveAdd = document.getElementById('modal-save-add');
  if (saveAdd) saveAdd.addEventListener('click', saveNewUser);

  var saveEdit = document.getElementById('modal-save-edit');
  if (saveEdit) saveEdit.addEventListener('click', function() {
    saveEditUser(this.getAttribute('data-id'));
  });
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass  = document.getElementById('login-pass').value;
  var users = DB.get('users');
  var user  = users.find(function(u){ return u.email === email && u.password === pass && u.status === 'active'; });
  var errEl = document.getElementById('login-error');
  if (!user) { errEl.textContent = 'Invalid credentials or account is inactive.'; return; }
  user.lastLogin = new Date().toISOString();
  DB.set('users', users);
  addLog('LOGIN', user.name, 'Logged in as ' + roleLabel(user.role));
  currentUser = user;
  DB.setObj('session', { id: user.id });
  startApp();
}

function doLogout() {
  currentUser = null;
  DB.setObj('session', {});
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-email').value = '';
  document.getElementById('login-pass').value = '';
}

function startApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  var initials = currentUser.name.split(' ').map(function(w){ return w[0]; }).join('').slice(0,2);
  document.getElementById('sidebar-avatar').textContent = initials;
  document.getElementById('sidebar-name').textContent   = currentUser.name;
  document.getElementById('sidebar-role').textContent   = roleLabel(currentUser.role);
  if (currentUser.role === 'manager') {
    document.getElementById('add-user-btn').style.display = 'none';
    document.getElementById('users-sub').textContent = 'View-only access for your role';
  } else {
    document.getElementById('add-user-btn').style.display = '';
    document.getElementById('users-sub').textContent = 'Manage accounts across all roles';
  }
  renderDashboard();
  showPage('dashboard');
}

// ─────────────────────────────────────────────
// INIT & EVENT WIRING
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  initDB();

  // Login button
  document.getElementById('btn-login').addEventListener('click', doLogin);

  // Enter key on login fields
  document.getElementById('login-email').addEventListener('keydown', function(e){ if (e.key === 'Enter') doLogin(); });
  document.getElementById('login-pass').addEventListener('keydown',  function(e){ if (e.key === 'Enter') doLogin(); });

  // Demo buttons
  document.querySelectorAll('.demo-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.getElementById('login-email').value = this.getAttribute('data-email');
      document.getElementById('login-pass').value  = this.getAttribute('data-pass');
      doLogin();
    });
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', doLogout);

  // Nav items
  document.querySelectorAll('.nav-item').forEach(function(item) {
    item.addEventListener('click', function() {
      showPage(this.getAttribute('data-page'));
    });
  });

  // Add user button
  document.getElementById('add-user-btn').addEventListener('click', openAddUser);

  // Search & filters
  document.getElementById('user-search').addEventListener('input', renderUsersTable);
  document.getElementById('role-filter').addEventListener('change', renderUsersTable);
  document.getElementById('status-filter').addEventListener('change', renderUsersTable);
  document.getElementById('log-search').addEventListener('input', renderLogs);
  document.getElementById('log-filter').addEventListener('change', renderLogs);

  // Clear logs
  document.getElementById('btn-clear-logs').addEventListener('click', clearLogs);

  // Modal close button (X)
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  // Modal overlay background click
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Restore session
  var session = DB.getObj('session');
  if (session && session.id) {
    var users = DB.get('users');
    var user  = users.find(function(u){ return u.id === session.id && u.status === 'active'; });
    if (user) { currentUser = user; startApp(); }
  }
});
