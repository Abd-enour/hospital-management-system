const db = require('../config/db');
const { MedicalRecordBuilder, MedicalRecordProxy, AppointmentContext, HospitalFacade, HospitalConfig } = require('../patterns');

// ── helpers ──
const q = (sql, p = []) => db.query(sql, p);
const ok = (res, data) => res.json(data);
const fail = (res, e) => res.status(500).json({ error: e.message });
const notFound = (res, m) => res.status(404).json({ error: m });
const badReq = (res, m) => res.status(400).json({ error: m });

// ══ STATS ══
exports.stats = async (req, res) => {
  try {
    const [[{ patients }]] = await q('SELECT COUNT(*) as patients FROM patients');
    const [[{ doctors }]] = await q('SELECT COUNT(*) as doctors FROM doctors');
    const [[{ appointments }]] = await q('SELECT COUNT(*) as appointments FROM appointments');
    const [[{ scheduled }]] = await q("SELECT COUNT(*) as scheduled FROM appointments WHERE status='scheduled'");
    const [[{ records }]] = await q('SELECT COUNT(*) as records FROM medical_records');
    const [[{ admissions }]] = await q("SELECT COUNT(*) as admissions FROM admissions WHERE status='admitted'");
    const [[{ pending_pay }]] = await q("SELECT COUNT(*) as pending_pay FROM payments WHERE status='pending'");
    ok(res, { patients, doctors, appointments, scheduled, records, admissions, pending_pay });
  } catch (e) { fail(res, e); }
};

// ══ DEPARTMENTS ══
exports.getDepts = async (req, res) => {
  try { ok(res, (await q('SELECT * FROM departments ORDER BY name'))[0]); }
  catch (e) { fail(res, e); }
};

// ══ PATIENTS ══
exports.getPatients = async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT p.id, u.name, u.email, u.phone, p.date_of_birth, p.blood_type,
             p.address, p.insurance_provider, p.insurance_number, p.insurance_status, u.id AS user_id
      FROM patients p JOIN users u ON p.user_id = u.id ORDER BY u.name`);
    ok(res, rows);
  } catch (e) { fail(res, e); }
};

exports.getPatient = async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT p.id, u.name, u.email, u.phone, p.date_of_birth, p.blood_type,
             p.address, p.insurance_provider, p.insurance_number, p.insurance_status
      FROM patients p JOIN users u ON p.user_id = u.id WHERE p.id = ?`, [req.params.id]);
    if (!rows.length) return notFound(res, 'Patient not found');
    ok(res, rows[0]);
  } catch (e) { fail(res, e); }
};

exports.updatePatient = async (req, res) => {
  const { name, phone, blood_type, date_of_birth, address, insurance_provider, insurance_number } = req.body;
  try {
    const [rows] = await q('SELECT user_id FROM patients WHERE id = ?', [req.params.id]);
    if (!rows.length) return notFound(res, 'Patient not found');
    if (name) await q('UPDATE users SET name=?, phone=? WHERE id=?', [name, phone || null, rows[0].user_id]);
    await q('UPDATE patients SET blood_type=?, date_of_birth=?, address=?, insurance_provider=?, insurance_number=? WHERE id=?',
      [blood_type || null, date_of_birth || null, address || null, insurance_provider || null, insurance_number || null, req.params.id]);
    ok(res, { message: 'Patient updated' });
  } catch (e) { fail(res, e); }
};

exports.deletePatient = async (req, res) => {
  try {
    const [rows] = await q('SELECT user_id FROM patients WHERE id = ?', [req.params.id]);
    if (!rows.length) return notFound(res, 'Patient not found');
    await q('DELETE FROM users WHERE id = ?', [rows[0].user_id]);
    ok(res, { message: 'Patient deleted' });
  } catch (e) { fail(res, e); }
};

exports.verifyInsurance = async (req, res) => {
  try {
    await q("UPDATE patients SET insurance_status='verified' WHERE id=?", [req.params.id]);
    ok(res, { message: 'Insurance verified' });
  } catch (e) { fail(res, e); }
};

// ══ DOCTORS ══
exports.getDoctors = async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT d.id, u.name, u.email, u.phone, d.specialization, dep.name AS department, d.department_id
      FROM doctors d JOIN users u ON d.user_id = u.id
      LEFT JOIN departments dep ON d.department_id = dep.id ORDER BY u.name`);
    ok(res, rows);
  } catch (e) { fail(res, e); }
};

// ══ AVAILABLE SLOTS ══
exports.getSlots = async (req, res) => {
  const { doctor_id, date } = req.query;
  if (!doctor_id || !date) return badReq(res, 'doctor_id and date are required');
  try {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    const [avail] = await q('SELECT * FROM doctor_availability WHERE doctor_id=? AND day_of_week=?', [doctor_id, dayOfWeek]);
    if (!avail.length) return ok(res, { slots: [], message: 'Doctor not available on this day' });

    const { start_time, end_time, slot_duration } = avail[0];
    const [booked] = await q(
      "SELECT scheduled_at FROM appointments WHERE doctor_id=? AND DATE(scheduled_at)=? AND status != 'cancelled'",
      [doctor_id, date]
    );
    const bookedTimes = booked.map(b => new Date(b.scheduled_at).toTimeString().slice(0, 5));

    const slots = [];
    const [sh, sm] = start_time.split(':').map(Number);
    const [eh, em] = end_time.split(':').map(Number);
    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;
    while (cur + slot_duration <= endMin) {
      const hh = String(Math.floor(cur / 60)).padStart(2, '0');
      const mm = String(cur % 60).padStart(2, '0');
      const time = `${hh}:${mm}`;
      slots.push({ time, available: !bookedTimes.includes(time) });
      cur += slot_duration;
    }
    ok(res, { slots });
  } catch (e) { fail(res, e); }
};

// ══ APPOINTMENTS ══
exports.getAppointments = async (req, res) => {
  try {
    let sql = `
      SELECT a.id, a.scheduled_at, a.status, a.notes, a.created_at, a.duration,
             up.name AS patient_name, ud.name AS doctor_name, a.patient_id, a.doctor_id
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users up ON p.user_id = up.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users ud ON d.user_id = ud.id`;
    const params = [];
    if (req.user.role === 'patient' && req.user.profileId) { sql += ' WHERE a.patient_id=?'; params.push(req.user.profileId); }
    else if (req.user.role === 'doctor' && req.user.profileId) { sql += ' WHERE a.doctor_id=?'; params.push(req.user.profileId); }
    sql += ' ORDER BY a.scheduled_at DESC';
    ok(res, (await q(sql, params))[0]);
  } catch (e) { fail(res, e); }
};

exports.createAppointment = async (req, res) => {
  let { patient_id, doctor_id, scheduled_at, notes } = req.body;
  if (req.user.role === 'patient') patient_id = req.user.profileId;
  if (!patient_id || !doctor_id || !scheduled_at) return badReq(res, 'patient_id, doctor_id and scheduled_at are required');
  try {
    // Use Facade pattern - handles conflict check and booking in one call
    const id = await HospitalFacade.bookAppointment(db, patient_id, doctor_id, scheduled_at, notes);
    ok(res, { message: 'Appointment booked successfully', id });
  } catch (e) {
    if (e.message.includes('already booked')) return res.status(409).json({ error: e.message });
    fail(res, e);
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  if (!['scheduled', 'completed', 'cancelled'].includes(status)) return badReq(res, 'Invalid status');
  try {
    const [rows] = await q('SELECT status FROM appointments WHERE id=?', [req.params.id]);
    if (!rows.length) return notFound(res, 'Appointment not found');
    // Use State pattern to validate and transition status
    const ctx = new AppointmentContext(rows[0].status);
    try {
      if (status === 'completed') ctx.complete();
      else if (status === 'cancelled') ctx.cancel();
      else if (status === 'scheduled') ctx.reschedule();
    } catch (stateErr) { return badReq(res, stateErr.message); }
    await q('UPDATE appointments SET status=? WHERE id=?', [ctx.getStatus(), req.params.id]);
    ok(res, { message: 'Status updated to ' + ctx.getStatus() });
  } catch (e) { fail(res, e); }
};

exports.deleteAppointment = async (req, res) => {
  try {
    const [r] = await q('DELETE FROM appointments WHERE id=?', [req.params.id]);
    if (!r.affectedRows) return notFound(res, 'Not found');
    ok(res, { message: 'Deleted' });
  } catch (e) { fail(res, e); }
};

// ══ MEDICAL RECORDS ══
exports.getRecords = async (req, res) => {
  try {
    let sql = `
      SELECT mr.id, mr.diagnosis, mr.treatment, mr.notes, mr.record_date, mr.created_at,
             up.name AS patient_name, ud.name AS doctor_name, mr.patient_id, mr.doctor_id
      FROM medical_records mr
      JOIN patients p ON mr.patient_id = p.id
      JOIN users up ON p.user_id = up.id
      JOIN doctors d ON mr.doctor_id = d.id
      JOIN users ud ON d.user_id = ud.id`;
    const params = [];
    if (req.user.role === 'patient' && req.user.profileId) { sql += ' WHERE mr.patient_id=?'; params.push(req.user.profileId); }
    else if (req.user.role === 'doctor' && req.user.profileId) { sql += ' WHERE mr.doctor_id=?'; params.push(req.user.profileId); }
    sql += ' ORDER BY mr.record_date DESC';
    ok(res, (await q(sql, params))[0]);
  } catch (e) { fail(res, e); }
};

exports.createRecord = async (req, res) => {
  const { patient_id, doctor_id, appointment_id, diagnosis, treatment, notes, record_date } = req.body;
  if (!patient_id || !record_date) return badReq(res, 'patient_id and record_date are required');
  try {
    const docId = (req.user.role === 'doctor' ? req.user.profileId : null) || doctor_id;
    if (!docId) return badReq(res, 'doctor_id is required');
    // Use Builder pattern to construct the medical record
    const record = new MedicalRecordBuilder()
      .setPatientId(patient_id)
      .setDoctorId(docId)
      .setAppointmentId(appointment_id)
      .setDiagnosis(diagnosis)
      .setTreatment(treatment)
      .setNotes(notes)
      .setDate(record_date)
      .build();
    const [r] = await q(
      'INSERT INTO medical_records (patient_id, doctor_id, appointment_id, diagnosis, treatment, notes, record_date) VALUES (?,?,?,?,?,?,?)',
      [record.patient_id, record.doctor_id, record.appointment_id, record.diagnosis, record.treatment, record.notes, record.record_date]
    );
    ok(res, { message: 'Medical record created', id: r.insertId });
  } catch (e) { fail(res, e); }
};

// ══ PRESCRIPTIONS ══
exports.getPrescriptions = async (req, res) => {
  try {
    let sql = `
      SELECT pr.id, pr.medication, pr.dosage, pr.instructions, pr.created_at,
             up.name AS patient_name, ud.name AS doctor_name, pr.patient_id, pr.medical_record_id
      FROM prescriptions pr
      JOIN patients p ON pr.patient_id = p.id
      JOIN users up ON p.user_id = up.id
      JOIN doctors d ON pr.doctor_id = d.id
      JOIN users ud ON d.user_id = ud.id`;
    const params = [];
    if (req.user.role === 'patient' && req.user.profileId) { sql += ' WHERE pr.patient_id=?'; params.push(req.user.profileId); }
    else if (req.user.role === 'doctor' && req.user.profileId) { sql += ' WHERE pr.doctor_id=?'; params.push(req.user.profileId); }
    sql += ' ORDER BY pr.created_at DESC';
    ok(res, (await q(sql, params))[0]);
  } catch (e) { fail(res, e); }
};

exports.createPrescription = async (req, res) => {
  const { medical_record_id, patient_id, medication, dosage, instructions } = req.body;
  if (!medical_record_id || !patient_id || !medication) return badReq(res, 'medical_record_id, patient_id and medication required');
  try {
    const docId = (req.user.role === 'doctor' ? req.user.profileId : null) || req.body.doctor_id;
    if (!docId) return badReq(res, 'doctor_id is required');
    const [r] = await q(
      'INSERT INTO prescriptions (medical_record_id, doctor_id, patient_id, medication, dosage, instructions) VALUES (?,?,?,?,?,?)',
      [medical_record_id, docId, patient_id, medication, dosage || null, instructions || null]
    );
    ok(res, { message: 'Prescription created', id: r.insertId });
  } catch (e) { fail(res, e); }
};

// ══ LAB TESTS ══
exports.getLabTests = async (req, res) => {
  try {
    let sql = `
      SELECT lt.id, lt.test_type, lt.status, lt.result, lt.ordered_at,
             up.name AS patient_name, ud.name AS doctor_name
      FROM lab_tests lt
      JOIN patients p ON lt.patient_id = p.id
      JOIN users up ON p.user_id = up.id
      JOIN doctors d ON lt.doctor_id = d.id
      JOIN users ud ON d.user_id = ud.id`;
    const params = [];
    if (req.user.role === 'patient' && req.user.profileId) { sql += ' WHERE lt.patient_id=?'; params.push(req.user.profileId); }
    else if (req.user.role === 'doctor' && req.user.profileId) { sql += ' WHERE lt.doctor_id=?'; params.push(req.user.profileId); }
    sql += ' ORDER BY lt.ordered_at DESC';
    ok(res, (await q(sql, params))[0]);
  } catch (e) { fail(res, e); }
};

exports.createLabTest = async (req, res) => {
  const { patient_id, test_type } = req.body;
  if (!patient_id || !test_type) return badReq(res, 'patient_id and test_type required');
  try {
    const docId = (req.user.role === 'doctor' ? req.user.profileId : null) || req.body.doctor_id;
    if (!docId) return badReq(res, 'doctor_id is required');
    const [r] = await q('INSERT INTO lab_tests (patient_id, doctor_id, test_type) VALUES (?,?,?)', [patient_id, docId, test_type]);
    ok(res, { message: 'Lab test ordered', id: r.insertId });
  } catch (e) { fail(res, e); }
};

exports.updateLabResult = async (req, res) => {
  if (!req.body.result) return badReq(res, 'result is required');
  try {
    await q("UPDATE lab_tests SET result=?, status='completed' WHERE id=?", [req.body.result, req.params.id]);
    ok(res, { message: 'Result updated' });
  } catch (e) { fail(res, e); }
};

// ══ PAYMENTS ══
exports.getPayments = async (req, res) => {
  try {
    let sql = `
      SELECT pay.id, pay.amount, pay.payment_method, pay.status, pay.insurance_covered,
             pay.issued_at, pay.paid_at, up.name AS patient_name, pay.patient_id
      FROM payments pay
      JOIN patients p ON pay.patient_id = p.id
      JOIN users up ON p.user_id = up.id`;
    const params = [];
    if (req.user.role === 'patient' && req.user.profileId) { sql += ' WHERE pay.patient_id=?'; params.push(req.user.profileId); }
    sql += ' ORDER BY pay.issued_at DESC';
    ok(res, (await q(sql, params))[0]);
  } catch (e) { fail(res, e); }
};

exports.createPayment = async (req, res) => {
  const { patient_id, amount, payment_method, appointment_id } = req.body;
  if (!patient_id || !amount) return badReq(res, 'patient_id and amount required');
  try {
    const [r] = await q('INSERT INTO payments (patient_id, appointment_id, amount, payment_method) VALUES (?,?,?,?)',
      [patient_id, appointment_id || null, amount, payment_method || 'cash']);
    ok(res, { message: 'Bill created', id: r.insertId });
  } catch (e) { fail(res, e); }
};

exports.processPayment = async (req, res) => {
  const { payment_method, insurance_covered } = req.body;
  try {
    await q("UPDATE payments SET status='paid', payment_method=?, insurance_covered=?, paid_at=NOW() WHERE id=?",
      [payment_method || 'cash', insurance_covered || 0, req.params.id]);
    ok(res, { message: 'Payment processed' });
  } catch (e) { fail(res, e); }
};

// ══ ROOMS ══
exports.getRooms = async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT r.id, r.room_number, r.bed_count, r.status, w.name AS ward_name, w.id AS ward_id
      FROM rooms r JOIN wards w ON r.ward_id = w.id ORDER BY w.name, r.room_number`);
    ok(res, rows);
  } catch (e) { fail(res, e); }
};

// ══ ADMISSIONS ══
exports.getAdmissions = async (req, res) => {
  try {
    const [rows] = await q(`
      SELECT a.id, a.admitted_at, a.discharged_at, a.status,
             up.name AS patient_name, r.room_number, w.name AS ward_name
      FROM admissions a
      JOIN patients p ON a.patient_id = p.id
      JOIN users up ON p.user_id = up.id
      JOIN rooms r ON a.room_id = r.id
      JOIN wards w ON r.ward_id = w.id
      ORDER BY a.admitted_at DESC`);
    ok(res, rows);
  } catch (e) { fail(res, e); }
};

exports.admitPatient = async (req, res) => {
  const { patient_id, room_id } = req.body;
  if (!patient_id || !room_id) return badReq(res, 'patient_id and room_id required');
  try {
    // Use Facade pattern - handles room check and admission in one call
    const id = await HospitalFacade.admitPatient(db, patient_id, room_id);
    ok(res, { message: 'Patient admitted', id });
  } catch (e) {
    if (e.message.includes('not available')) return res.status(409).json({ error: e.message });
    fail(res, e);
  }
};

exports.discharge = async (req, res) => {
  try {
    const [rows] = await q('SELECT room_id FROM admissions WHERE id=?', [req.params.id]);
    if (!rows.length) return notFound(res, 'Admission not found');
    const today = new Date().toISOString().split('T')[0];
    await q("UPDATE admissions SET status='discharged', discharged_at=? WHERE id=?", [today, req.params.id]);
    await q("UPDATE rooms SET status='available' WHERE id=?", [rows[0].room_id]);
    ok(res, { message: 'Patient discharged' });
  } catch (e) { fail(res, e); }
};
