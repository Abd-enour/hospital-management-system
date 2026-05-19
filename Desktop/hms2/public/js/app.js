// MediCore HMS — Frontend App
// Authors: ABDENNOUR OUSSAID, NASSIM BOUKAHOUL, SAMI DAHMOUNI

'use strict';

// ── STATE ──
let _token = localStorage.getItem('hms_token');
let _user  = JSON.parse(localStorage.getItem('hms_user') || 'null');

// ── API ──
async function api(method, path, body) {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = 'Bearer ' + _token;
  try {
    const r = await fetch('/api' + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  } catch (e) { throw e; }
}

// ── TOAST ──
function toast(msg, type = 'success') {
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="toast-dot"></div><span class="toast-msg">${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── MODAL ──
function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// ── SIDEBAR MOBILE ──
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.querySelector('.sidebar-overlay').classList.toggle('open');
}

// ── AUTH TABS ──
function authTab(t) {
  document.querySelectorAll('.auth-tab').forEach(x => x.classList.remove('active'));
  document.querySelector(`[data-tab="${t}"]`).classList.add('active');
  document.getElementById('loginSection').classList.toggle('hidden', t !== 'login');
  document.getElementById('registerSection').classList.toggle('hidden', t !== 'register');
}

// ══════════════════════════════════════
// LOGIN
// ══════════════════════════════════════
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-pass').value;
  if (!email || !password) return toast('Please fill all fields', 'error');
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    const data = await api('POST', '/auth/login', { email, password });
    _token = data.token; _user = data.user;
    localStorage.setItem('hms_token', _token);
    localStorage.setItem('hms_user', JSON.stringify(_user));
    bootApp();
    toast('Welcome back, ' + _user.name + '!');
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Sign in'; }
}

// ══════════════════════════════════════
// REGISTER
// ══════════════════════════════════════
async function doRegister() {
  const body = {
    name: document.getElementById('r-name').value.trim(),
    email: document.getElementById('r-email').value.trim(),
    password: document.getElementById('r-pass').value,
    role: document.getElementById('r-role').value,
    phone: document.getElementById('r-phone').value.trim(),
    date_of_birth: document.getElementById('r-dob').value,
    blood_type: document.getElementById('r-blood').value,
    address: document.getElementById('r-addr').value.trim(),
    insurance_provider: document.getElementById('r-ins').value.trim(),
  };
  if (!body.name || !body.email || !body.password) return toast('Name, email and password are required', 'error');
  if (body.password.length < 6) return toast('Password must be at least 6 characters', 'error');
  const btn = document.getElementById('register-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api('POST', '/auth/register', body);
    toast('Account created! Please sign in.');
    authTab('login');
    document.getElementById('l-email').value = body.email;
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Create account'; }
}

// ── LOGOUT ──
function doLogout() {
  _token = null; _user = null;
  localStorage.removeItem('hms_token');
  localStorage.removeItem('hms_user');
  document.getElementById('auth-view').style.display = 'grid';
  document.getElementById('app-view').style.display = 'none';
}

// ══════════════════════════════════════
// BOOT APP
// ══════════════════════════════════════
function bootApp() {
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'flex';

  document.getElementById('u-name').textContent = _user.name;
  document.getElementById('u-role').textContent = _user.role;
  document.getElementById('u-av').textContent = _user.name[0].toUpperCase();
  document.getElementById('u-av').className = 'user-av av-' + _user.role;
  document.getElementById('mob-name').textContent = _user.name;

  // Show correct nav items per role
  document.querySelectorAll('[data-roles]').forEach(el => {
    const roles = el.dataset.roles.split(',');
    el.classList.toggle('hidden', !roles.includes(_user.role));
  });

  const first = { admin:'dashboard', doctor:'dr-home', nurse:'nurse-home', receptionist:'rec-home', patient:'pat-home' };
  goTo(first[_user.role] || 'dashboard');
}

// ══════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════
function goTo(page) {
  // close mobile sidebar if open
  document.querySelector('.sidebar').classList.remove('open');
  document.querySelector('.sidebar-overlay').classList.remove('open');

  document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('pg-' + page)?.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');

  const map = {
    dashboard: loadDash, patients: loadPatients, doctors: loadDoctors,
    appointments: loadAppts, records: loadRecords,
    prescriptions: loadPrescriptions, 'lab-tests': loadLabTests,
    payments: loadPayments, rooms: loadRooms, admissions: loadAdmissions,
    'dr-home': loadDrHome, 'nurse-home': loadNurseHome,
    'rec-home': loadRecHome,
    'pat-home': loadPatHome, 'pat-appts': loadPatAppts,
    'pat-records': loadPatRecords, 'pat-prescriptions': loadPatPrescriptions,
    'pat-payments': loadPatPayments,
  };
  map[page]?.();
}

// ══════════════════════════════════════
// TABLE HELPER
// ══════════════════════════════════════
function renderTbl(id, rows, rowFn, cols, empty = 'No records found') {
  const tb = document.getElementById(id);
  if (!tb) return;
  if (!rows?.length) {
    tb.innerHTML = `<tr><td colspan="${cols}"><div class="empty-state"><div class="empty-icon">📋</div><h3>${empty}</h3><p>Nothing here yet.</p></div></td></tr>`;
    return;
  }
  tb.innerHTML = rows.map(r => '<tr>' + rowFn(r) + '</tr>').join('');
}
function setLoad(id, cols) {
  const tb = document.getElementById(id);
  if (tb) tb.innerHTML = `<tr><td colspan="${cols}" class="loading-cell"><span class="spinner"></span></td></tr>`;
}

// ── FORMATTERS ──
function fmtDT(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function fmtD(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
}
function apptBadge(s) {
  return s === 'scheduled' ? 'badge-yellow' : s === 'completed' ? 'badge-green' : 'badge-red';
}

// ══════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════
async function loadDash() {
  try {
    const s = await api('GET', '/stats');
    const ids = { patients:'s-pat', doctors:'s-doc', appointments:'s-appt', scheduled:'s-sched', records:'s-rec', admissions:'s-adm', pending_pay:'s-pay' };
    for (const [k,id] of Object.entries(ids)) { const el = document.getElementById(id); if (el) el.textContent = s[k] ?? '—'; }
    const appts = await api('GET', '/appointments');
    renderTbl('dash-appts', appts.slice(0,8), a => `
      <td><div class="td-name">${a.patient_name}</div></td>
      <td>${a.doctor_name}</td>
      <td>${fmtDT(a.scheduled_at)}</td>
      <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
    `, 4, 'No appointments yet');
  } catch (e) { toast('Could not load dashboard', 'error'); }
}

// ══════════════════════════════════════
// PATIENTS
// ══════════════════════════════════════
let _pts = [];
async function loadPatients() {
  setLoad('tb-pts', 6);
  try { _pts = await api('GET', '/patients'); showPatients(_pts); }
  catch (e) { toast('Could not load patients', 'error'); }
}
function showPatients(list) {
  renderTbl('tb-pts', list, p => `
    <td><div class="td-name">${p.name}</div><div class="td-sub">${p.email}</div></td>
    <td>${p.phone || '—'}</td>
    <td>${p.blood_type ? `<span class="badge badge-red">${p.blood_type}</span>` : '—'}</td>
    <td>${p.insurance_provider || '—'}<br>${p.insurance_status ? `<span class="badge ${p.insurance_status==='verified'?'badge-green':'badge-yellow'} " style="margin-top:2px">${p.insurance_status}</span>` : ''}</td>
    <td>${p.address || '—'}</td>
    <td><div class="td-actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditPt(${p.id})">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="delPt(${p.id},'${p.name.replace(/'/g,"\\'")}')">Delete</button>
      ${p.insurance_status !== 'verified' ? `<button class="btn btn-success btn-xs" onclick="verifyIns(${p.id})">Verify ins.</button>` : ''}
    </div></td>
  `, 6, 'No patients registered');
}
function filterPts(q) { showPatients(_pts.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase()))); }

function openEditPt(id) {
  const p = _pts.find(x => x.id === id); if (!p) return;
  document.getElementById('ep-id').value = p.id;
  document.getElementById('ep-name').value = p.name;
  document.getElementById('ep-phone').value = p.phone || '';
  document.getElementById('ep-blood').value = p.blood_type || '';
  document.getElementById('ep-dob').value = p.date_of_birth?.split('T')[0] || '';
  document.getElementById('ep-addr').value = p.address || '';
  document.getElementById('ep-ins').value = p.insurance_provider || '';
  document.getElementById('ep-ins-num').value = p.insurance_number || '';
  openModal('m-edit-pt');
}
async function savePt() {
  const id = document.getElementById('ep-id').value;
  if (!id) return toast('No patient selected', 'error');
  const body = {
    name: document.getElementById('ep-name').value,
    phone: document.getElementById('ep-phone').value,
    blood_type: document.getElementById('ep-blood').value,
    date_of_birth: document.getElementById('ep-dob').value,
    address: document.getElementById('ep-addr').value,
    insurance_provider: document.getElementById('ep-ins').value,
    insurance_number: document.getElementById('ep-ins-num').value,
  };
  try { await api('PUT', '/patients/' + id, body); toast('Patient updated'); closeModal('m-edit-pt'); loadPatients(); }
  catch (e) { toast(e.message, 'error'); }
}
async function delPt(id, name) {
  if (!confirm(`Delete patient "${name}"? This cannot be undone.`)) return;
  try { await api('DELETE', '/patients/' + id); toast('Patient deleted'); loadPatients(); }
  catch (e) { toast(e.message, 'error'); }
}
async function verifyIns(id) {
  try { await api('PATCH', `/patients/${id}/verify-insurance`, {}); toast('Insurance verified'); loadPatients(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// DOCTORS
// ══════════════════════════════════════
let _docs = [];
async function loadDoctors() {
  setLoad('tb-docs', 4);
  try { _docs = await api('GET', '/doctors'); showDoctors(_docs); }
  catch (e) { toast('Could not load doctors', 'error'); }
}
function showDoctors(list) {
  renderTbl('tb-docs', list, d => `
    <td><div class="td-name">${d.name}</div><div class="td-sub">${d.email}</div></td>
    <td>${d.specialization ? `<span class="badge badge-blue">${d.specialization}</span>` : '—'}</td>
    <td>${d.department || '—'}</td>
    <td>${d.phone || '—'}</td>
  `, 4, 'No doctors found');
}
function filterDocs(q) { showDoctors(_docs.filter(d => d.name.toLowerCase().includes(q.toLowerCase()) || (d.specialization||'').toLowerCase().includes(q.toLowerCase()))); }

// ══════════════════════════════════════
// APPOINTMENT TIME SLOTS
// ══════════════════════════════════════
let _selectedSlot = null;

async function loadSlots(doctorId, date, containerId) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!doctorId || !date) { wrap.innerHTML = '<p class="slots-empty">Select a doctor and date first.</p>'; return; }
  wrap.innerHTML = '<p class="slots-loading"><span class="spinner"></span> Loading slots...</p>';
  _selectedSlot = null;
  try {
    const data = await api('GET', `/slots?doctor_id=${doctorId}&date=${date}`);
    if (!data.slots?.length) { wrap.innerHTML = '<p class="slots-empty">No availability on this day.</p>'; return; }
    wrap.innerHTML = '<div class="slots-grid">' + data.slots.map(s => `
      <button class="slot-btn ${s.available ? '' : 'unavailable'}"
        onclick="${s.available ? `selectSlot(this,'${s.time}','${date}')` : ''}"
        ${s.available ? '' : 'disabled'}>${s.time}</button>
    `).join('') + '</div>';
  } catch (e) { wrap.innerHTML = '<p class="slots-empty">Could not load slots.</p>'; }
}

function selectSlot(btn, time, date) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  _selectedSlot = date + 'T' + time + ':00';
}

// ══════════════════════════════════════
// APPOINTMENTS (Admin/Receptionist)
// ══════════════════════════════════════
let _appts = [];
async function loadAppts() {
  setLoad('tb-appts', 5);
  try {
    _appts = await api('GET', '/appointments');
    showAppts(_appts);
    await fillApptSelects('na-pt', 'na-doc');
  } catch (e) { toast('Could not load appointments', 'error'); }
}
function showAppts(list) {
  renderTbl('tb-appts', list, a => `
    <td><div class="td-name">${a.patient_name}</div></td>
    <td>${a.doctor_name}</td>
    <td>${fmtDT(a.scheduled_at)}</td>
    <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
    <td><div class="td-actions">
      ${a.status === 'scheduled' ? `
        <button class="btn btn-success btn-sm" onclick="chgStatus(${a.id},'completed')">Complete</button>
        <button class="btn btn-danger btn-sm" onclick="chgStatus(${a.id},'cancelled')">Cancel</button>
      ` : '—'}
    </div></td>
  `, 5, 'No appointments found');
}
async function fillApptSelects(ptId, docId) {
  const [pts, docs] = await Promise.all([api('GET', '/patients'), api('GET', '/doctors')]);
  const ptEl = document.getElementById(ptId); const docEl = document.getElementById(docId);
  if (ptEl) ptEl.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  if (docEl) docEl.innerHTML = docs.map(d => `<option value="${d.id}">${d.name}${d.specialization ? ' — '+d.specialization : ''}</option>`).join('');
}

function openApptModal() {
  _selectedSlot = null;
  document.getElementById('na-date').value = '';
  document.getElementById('na-slots').innerHTML = '<p class="slots-empty">Select a doctor and date to see available slots.</p>';
  openModal('m-appt');
}

async function bookAppt() {
  if (!_selectedSlot) return toast('Please select a time slot', 'error');
  const body = {
    patient_id: +document.getElementById('na-pt').value,
    doctor_id: +document.getElementById('na-doc').value,
    scheduled_at: _selectedSlot,
    notes: document.getElementById('na-notes').value,
  };
  try {
    await api('POST', '/appointments', body);
    toast('Appointment booked');
    closeModal('m-appt');
    loadAppts();
  } catch (e) { toast(e.message, 'error'); }
}

async function chgStatus(id, status) {
  try { await api('PATCH', `/appointments/${id}/status`, { status }); toast('Appointment ' + status); loadAppts(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// MEDICAL RECORDS
// ══════════════════════════════════════
let _recs = [];
async function loadRecords() {
  setLoad('tb-recs', 5);
  try {
    _recs = await api('GET', '/records');
    renderTbl('tb-recs', _recs, r => `
      <td><div class="td-name">${r.patient_name}</div></td>
      <td>${r.doctor_name}</td>
      <td>${r.diagnosis || '—'}</td>
      <td>${r.treatment || '—'}</td>
      <td>${fmtD(r.record_date)}</td>
    `, 5, 'No medical records found');
    await fillRecSelects();
  } catch (e) { toast('Could not load records', 'error'); }
}
async function fillRecSelects() {
  const [pts, docs] = await Promise.all([api('GET', '/patients'), api('GET', '/doctors')]);
  const pOpts = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const dOpts = docs.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  ['nr-pt'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = pOpts; });
  ['nr-doc'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = dOpts; });
  // also fill prescription patient & record selects
  const prPt = document.getElementById('pr-pt'); if (prPt) prPt.innerHTML = pOpts;
  const prRec = document.getElementById('pr-rec');
  if (prRec) prRec.innerHTML = '<option value="">Select a record...</option>' +
    _recs.map(r => `<option value="${r.id}">${r.patient_name} — ${r.diagnosis || 'No diagnosis'} (${fmtD(r.record_date)})</option>`).join('');
}
async function saveRecord() {
  const body = {
    patient_id: +document.getElementById('nr-pt').value,
    doctor_id: +document.getElementById('nr-doc').value,
    diagnosis: document.getElementById('nr-diag').value,
    treatment: document.getElementById('nr-treat').value,
    notes: document.getElementById('nr-notes').value,
    record_date: document.getElementById('nr-date').value,
  };
  if (!body.patient_id || !body.record_date) return toast('Patient and date are required', 'error');
  try { await api('POST', '/records', body); toast('Medical record created'); closeModal('m-rec'); loadRecords(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// PRESCRIPTIONS
// ══════════════════════════════════════
async function loadPrescriptions() {
  setLoad('tb-pres', 5);
  try {
    const list = await api('GET', '/prescriptions');
    renderTbl('tb-pres', list, p => `
      <td><div class="td-name">${p.patient_name}</div></td>
      <td>${p.doctor_name}</td>
      <td>${p.medication}</td>
      <td>${p.dosage || '—'}</td>
      <td>${p.instructions || '—'}</td>
    `, 5, 'No prescriptions found');
    await fillRecSelects();
  } catch (e) { toast('Could not load prescriptions', 'error'); }
}
async function savePresc() {
  const body = {
    medical_record_id: +document.getElementById('pr-rec').value,
    patient_id: +document.getElementById('pr-pt').value,
    medication: document.getElementById('pr-med').value,
    dosage: document.getElementById('pr-dos').value,
    instructions: document.getElementById('pr-inst').value,
  };
  if (!body.medical_record_id || !body.patient_id || !body.medication) return toast('Please fill all required fields', 'error');
  try { await api('POST', '/prescriptions', body); toast('Prescription created'); closeModal('m-pres'); loadPrescriptions(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// LAB TESTS
// ══════════════════════════════════════
async function loadLabTests() {
  setLoad('tb-labs', 5);
  try {
    const list = await api('GET', '/lab-tests');
    renderTbl('tb-labs', list, t => `
      <td><div class="td-name">${t.patient_name}</div></td>
      <td>${t.doctor_name}</td>
      <td>${t.test_type}</td>
      <td><span class="badge ${t.status==='completed'?'badge-green':t.status==='in_progress'?'badge-yellow':'badge-blue'}">${t.status.replace('_',' ')}</span></td>
      <td>${t.result || '—'}</td>
    `, 5, 'No lab tests ordered');
    const pts = await api('GET', '/patients');
    const ltPt = document.getElementById('lt-pt'); if (ltPt) ltPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (e) { toast('Could not load lab tests', 'error'); }
}
async function saveLabTest() {
  const body = { patient_id: +document.getElementById('lt-pt').value, test_type: document.getElementById('lt-type').value };
  if (!body.test_type) return toast('Please select a test type', 'error');
  try { await api('POST', '/lab-tests', body); toast('Lab test ordered'); closeModal('m-lab'); loadLabTests(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════
async function loadPayments() {
  setLoad('tb-pay', 6);
  try {
    const list = await api('GET', '/payments');
    renderTbl('tb-pay', list, p => `
      <td><div class="td-name">${p.patient_name}</div></td>
      <td>${parseFloat(p.amount).toFixed(2)} PLN</td>
      <td>${(p.payment_method||'').replace('_',' ')}</td>
      <td><span class="badge ${p.status==='paid'?'badge-green':p.status==='pending'?'badge-yellow':'badge-red'}">${p.status.replace('_',' ')}</span></td>
      <td>${p.insurance_covered > 0 ? parseFloat(p.insurance_covered).toFixed(2)+' PLN' : '—'}</td>
      <td>${p.status==='pending' ? `<button class="btn btn-success btn-sm" onclick="processPayment(${p.id})">Process</button>` : '—'}</td>
    `, 6, 'No payments found');
    const pts = await api('GET', '/patients');
    const payPt = document.getElementById('pay-pt'); if (payPt) payPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (e) { toast('Could not load payments', 'error'); }
}
async function createBill() {
  const body = { patient_id: +document.getElementById('pay-pt').value, amount: parseFloat(document.getElementById('pay-amt').value), payment_method: document.getElementById('pay-mth').value };
  if (!body.amount || isNaN(body.amount) || body.amount <= 0) return toast('Enter a valid amount', 'error');
  try { await api('POST', '/payments', body); toast('Bill created'); closeModal('m-pay'); loadPayments(); }
  catch (e) { toast(e.message, 'error'); }
}
async function processPayment(id) {
  const method = prompt('Payment method (cash / card / insurance / bank_transfer):', 'cash');
  if (!method) return;
  try { await api('PATCH', `/payments/${id}/process`, { payment_method: method }); toast('Payment processed'); loadPayments(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// ROOMS
// ══════════════════════════════════════
async function loadRooms() {
  setLoad('tb-rooms', 4);
  try {
    const list = await api('GET', '/rooms');
    renderTbl('tb-rooms', list, r => `
      <td><div class="td-name">Room ${r.room_number}</div></td>
      <td>${r.ward_name}</td>
      <td>${r.bed_count}</td>
      <td><span class="badge ${r.status==='available'?'badge-green':r.status==='occupied'?'badge-red':'badge-yellow'}">${r.status}</span></td>
    `, 4, 'No rooms found');
  } catch (e) { toast('Could not load rooms', 'error'); }
}

// ══════════════════════════════════════
// ADMISSIONS
// ══════════════════════════════════════
async function loadAdmissions() {
  setLoad('tb-adm', 5);
  try {
    const list = await api('GET', '/admissions');
    renderTbl('tb-adm', list, a => `
      <td><div class="td-name">${a.patient_name}</div></td>
      <td>Room ${a.room_number} — ${a.ward_name}</td>
      <td>${fmtD(a.admitted_at)}</td>
      <td><span class="badge ${a.status==='admitted'?'badge-blue':'badge-gray'}">${a.status}</span></td>
      <td>${a.status==='admitted' ? `<button class="btn btn-warning btn-sm" onclick="discharge(${a.id})">Discharge</button>` : '—'}</td>
    `, 5, 'No admissions found');
    const [pts, rooms] = await Promise.all([api('GET', '/patients'), api('GET', '/rooms')]);
    const admPt = document.getElementById('adm-pt'); if (admPt) admPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const admRm = document.getElementById('adm-rm'); if (admRm) admRm.innerHTML = rooms.filter(r => r.status==='available').map(r => `<option value="${r.id}">Room ${r.room_number} — ${r.ward_name}</option>`).join('');
  } catch (e) { toast('Could not load admissions', 'error'); }
}
async function admitPatient() {
  const body = { patient_id: +document.getElementById('adm-pt').value, room_id: +document.getElementById('adm-rm').value };
  if (!body.patient_id || !body.room_id) return toast('Please select patient and room', 'error');
  try { await api('POST', '/admissions', body); toast('Patient admitted'); closeModal('m-adm'); loadAdmissions(); }
  catch (e) { toast(e.message, 'error'); }
}
async function discharge(id) {
  if (!confirm('Discharge this patient?')) return;
  try { await api('PATCH', `/admissions/${id}/discharge`, {}); toast('Patient discharged'); loadAdmissions(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// DOCTOR HOME
// ══════════════════════════════════════
async function loadDrHome() {
  try {
    const [appts, recs, labs] = await Promise.all([api('GET', '/appointments'), api('GET', '/records'), api('GET', '/lab-tests')]);
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('dr-s-appts', appts.length);
    setEl('dr-s-sched', appts.filter(a => a.status==='scheduled').length);
    setEl('dr-s-recs', recs.length);
    renderTbl('tb-dr-appts', appts.slice(0,8), a => `
      <td><div class="td-name">${a.patient_name}</div></td>
      <td>${fmtDT(a.scheduled_at)}</td>
      <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
      <td>${a.status==='scheduled' ? `<button class="btn btn-success btn-sm" onclick="chgStatusDr(${a.id},'completed')">Complete</button>` : '—'}</td>
    `, 4, 'No appointments');
    // fill record selects for doctor
    const pts = await api('GET', '/patients');
    const nrPt = document.getElementById('nr-pt'); if (nrPt) nrPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const ltPt = document.getElementById('lt-pt'); if (ltPt) ltPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    _recs = recs;
    const prPt = document.getElementById('pr-pt'); if (prPt) prPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const prRec = document.getElementById('pr-rec');
    if (prRec) prRec.innerHTML = '<option value="">Select a record...</option>' + recs.map(r => `<option value="${r.id}">${r.patient_name} — ${r.diagnosis || 'No diagnosis'}</option>`).join('');
  } catch (e) { toast('Could not load', 'error'); }
}
async function chgStatusDr(id, status) {
  try { await api('PATCH', `/appointments/${id}/status`, { status }); toast('Appointment ' + status); loadDrHome(); }
  catch (e) { toast(e.message, 'error'); }
}

// ══════════════════════════════════════
// NURSE HOME
// ══════════════════════════════════════
async function loadNurseHome() {
  try {
    const [adms, rooms] = await Promise.all([api('GET', '/admissions'), api('GET', '/rooms')]);
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('nu-s-adm', adms.filter(a => a.status==='admitted').length);
    setEl('nu-s-rooms', rooms.filter(r => r.status==='available').length);
    renderTbl('tb-nu-adm', adms, a => `
      <td><div class="td-name">${a.patient_name}</div></td>
      <td>Room ${a.room_number} — ${a.ward_name}</td>
      <td>${fmtD(a.admitted_at)}</td>
      <td><span class="badge ${a.status==='admitted'?'badge-blue':'badge-gray'}">${a.status}</span></td>
      <td>${a.status==='admitted' ? `<button class="btn btn-warning btn-sm" onclick="discharge(${a.id})">Discharge</button>` : '—'}</td>
    `, 5, 'No current admissions');
    const pts = await api('GET', '/patients');
    const admPt = document.getElementById('adm-pt'); if (admPt) admPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    const admRm = document.getElementById('adm-rm'); if (admRm) admRm.innerHTML = rooms.filter(r => r.status==='available').map(r => `<option value="${r.id}">Room ${r.room_number} — ${r.ward_name}</option>`).join('');
  } catch (e) { toast('Could not load', 'error'); }
}

// ══════════════════════════════════════
// RECEPTIONIST HOME
// ══════════════════════════════════════
async function loadRecHome() {
  try {
    const [pts, appts, pays] = await Promise.all([api('GET', '/patients'), api('GET', '/appointments'), api('GET', '/payments')]);
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('rc-s-pts', pts.length);
    setEl('rc-s-appts', appts.length);
    const today = new Date().toDateString();
    setEl('rc-s-today', appts.filter(a => new Date(a.scheduled_at).toDateString()===today).length);
    setEl('rc-s-pay', pays.filter(p => p.status==='pending').length);
    renderTbl('tb-rc-appts', appts.slice(0,8), a => `
      <td><div class="td-name">${a.patient_name}</div></td>
      <td>${a.doctor_name}</td>
      <td>${fmtDT(a.scheduled_at)}</td>
      <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
    `, 4, 'No appointments');
    await fillApptSelects('na-pt', 'na-doc');
    const payPt = document.getElementById('pay-pt'); if (payPt) payPt.innerHTML = pts.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (e) { toast('Could not load', 'error'); }
}

// ══════════════════════════════════════
// PATIENT PORTAL
// ══════════════════════════════════════
async function loadPatHome() {
  document.getElementById('pat-welcome').textContent = _user.name;
  try {
    const [appts, recs] = await Promise.all([api('GET', '/appointments'), api('GET', '/records')]);
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('pat-s-appts', appts.length);
    setEl('pat-s-upc', appts.filter(a => a.status==='scheduled').length);
    setEl('pat-s-recs', recs.length);
    renderTbl('tb-pat-recent', appts.slice(0,5), a => `
      <td>${a.doctor_name}</td>
      <td>${fmtDT(a.scheduled_at)}</td>
      <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
    `, 3, 'No appointments yet');
  } catch (e) { toast('Could not load', 'error'); }
}

async function loadPatAppts() {
  setLoad('tb-pat-appts', 4);
  try {
    const list = await api('GET', '/appointments');
    renderTbl('tb-pat-appts', list, a => `
      <td>${a.doctor_name}</td>
      <td>${fmtDT(a.scheduled_at)}</td>
      <td><span class="badge ${apptBadge(a.status)}">${a.status}</span></td>
      <td>${a.notes || '—'}</td>
    `, 4, 'No appointments yet');
  } catch (e) { toast('Could not load', 'error'); }
}

async function openPatBook() {
  _selectedSlot = null;
  const docs = await api('GET', '/doctors');
  document.getElementById('pb-doc').innerHTML = docs.map(d => `<option value="${d.id}">${d.name}${d.specialization?' — '+d.specialization:''}</option>`).join('');
  document.getElementById('pb-date').value = '';
  document.getElementById('pb-slots').innerHTML = '<p class="slots-empty">Select a doctor and date to see available slots.</p>';
  openModal('m-pat-book');
}

async function patBookAppt() {
  if (!_selectedSlot) return toast('Please select a time slot', 'error');
  const btn = document.getElementById('pb-book-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  try {
    await api('POST', '/appointments', {
      doctor_id: +document.getElementById('pb-doc').value,
      scheduled_at: _selectedSlot,
      notes: document.getElementById('pb-notes').value,
    });
    toast('Appointment booked successfully!');
    closeModal('m-pat-book');
    document.getElementById('pb-notes').value = '';
    goTo('pat-appts');
  } catch (e) { toast(e.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Book Appointment'; }
}

async function loadPatRecords() {
  setLoad('tb-pat-recs', 4);
  try {
    const list = await api('GET', '/records');
    renderTbl('tb-pat-recs', list, r => `
      <td>${r.doctor_name}</td>
      <td>${r.diagnosis || '—'}</td>
      <td>${r.treatment || '—'}</td>
      <td>${fmtD(r.record_date)}</td>
    `, 4, 'No records yet');
  } catch (e) { toast('Could not load', 'error'); }
}

async function loadPatPrescriptions() {
  setLoad('tb-pat-pres', 4);
  try {
    const list = await api('GET', '/prescriptions');
    renderTbl('tb-pat-pres', list, p => `
      <td>${p.doctor_name}</td>
      <td><strong>${p.medication}</strong></td>
      <td>${p.dosage || '—'}</td>
      <td>${p.instructions || '—'}</td>
    `, 4, 'No prescriptions yet');
  } catch (e) { toast('Could not load', 'error'); }
}

async function loadPatPayments() {
  setLoad('tb-pat-pay', 4);
  try {
    const list = await api('GET', '/payments');
    renderTbl('tb-pat-pay', list, p => `
      <td>${fmtD(p.issued_at)}</td>
      <td>${parseFloat(p.amount).toFixed(2)} PLN</td>
      <td>${(p.payment_method||'').replace('_',' ')}</td>
      <td><span class="badge ${p.status==='paid'?'badge-green':p.status==='pending'?'badge-yellow':'badge-red'}">${p.status}</span></td>
    `, 4, 'No payments found');
  } catch (e) { toast('Could not load', 'error'); }
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  if (_token && _user) {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';
    bootApp();
  } else {
    document.getElementById('auth-view').style.display = 'grid';
    document.getElementById('app-view').style.display = 'none';
  }

  // Enter key on login
  document.getElementById('l-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

  // Sidebar overlay click
  document.querySelector('.sidebar-overlay')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.remove('open');
    document.querySelector('.sidebar-overlay').classList.remove('open');
  });

  // Slot loading on doctor/date change
  document.getElementById('na-doc')?.addEventListener('change', () => {
    const date = document.getElementById('na-date')?.value;
    const docId = document.getElementById('na-doc')?.value;
    if (date) loadSlots(docId, date, 'na-slots');
  });
  document.getElementById('na-date')?.addEventListener('change', () => {
    const date = document.getElementById('na-date')?.value;
    const docId = document.getElementById('na-doc')?.value;
    if (docId) loadSlots(docId, date, 'na-slots');
  });
  document.getElementById('pb-doc')?.addEventListener('change', () => {
    const date = document.getElementById('pb-date')?.value;
    const docId = document.getElementById('pb-doc')?.value;
    if (date) loadSlots(docId, date, 'pb-slots');
  });
  document.getElementById('pb-date')?.addEventListener('change', () => {
    const date = document.getElementById('pb-date')?.value;
    const docId = document.getElementById('pb-doc')?.value;
    if (docId) loadSlots(docId, date, 'pb-slots');
  });
});
