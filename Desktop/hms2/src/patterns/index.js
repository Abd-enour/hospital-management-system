// =============================================
// DESIGN PATTERNS - Hospital Management System
// =============================================

// ── PATTERN 1: SINGLETON (ABDENNOUR OUSSAID) ──
// Ensures only one HospitalConfig instance exists across the whole app.
// Instead of creating a new config object every time, we always return the same one.
class HospitalConfig {
  constructor() {
    if (HospitalConfig._instance) return HospitalConfig._instance;
    this.hospitalName = 'MediCore Hospital';
    this.maxSlotsPerDay = 20;
    this.slotDuration = 30; // minutes
    this.currency = 'PLN';
    this.version = '3.0.0';
    HospitalConfig._instance = this;
  }

  static getInstance() {
    if (!HospitalConfig._instance) new HospitalConfig();
    return HospitalConfig._instance;
  }

  get(key) { return this[key]; }
  set(key, value) { this[key] = value; }
}

// ── PATTERN 2: FACTORY METHOD (NASSIM BOUKAHOUL) ──
// Creates the correct user object based on role without exposing the creation logic.
// The caller just says "give me a doctor user" and gets the right object back.
class UserFactory {
  static create(role, data) {
    const map = {
      patient:      PatientUser,
      doctor:       DoctorUser,
      nurse:        NurseUser,
      receptionist: ReceptionistUser,
      admin:        AdminUser,
    };
    const UserClass = map[role?.toLowerCase()];
    if (!UserClass) throw new Error(`Unknown role: ${role}`);
    return new UserClass(data);
  }
}

class BaseUser {
  constructor(data) { Object.assign(this, data); }
  getRole() { return this.role; }
  canAccess(resource) { return false; }
}
class PatientUser extends BaseUser {
  getRole() { return 'patient'; }
  canAccess(resource) { return ['appointments','records','prescriptions','payments'].includes(resource); }
}
class DoctorUser extends BaseUser {
  getRole() { return 'doctor'; }
  canAccess(resource) { return ['appointments','records','prescriptions','lab-tests','patients'].includes(resource); }
}
class NurseUser extends BaseUser {
  getRole() { return 'nurse'; }
  canAccess(resource) { return ['admissions','rooms','patients'].includes(resource); }
}
class ReceptionistUser extends BaseUser {
  getRole() { return 'receptionist'; }
  canAccess(resource) { return ['patients','appointments','payments'].includes(resource); }
}
class AdminUser extends BaseUser {
  getRole() { return 'admin'; }
  canAccess(resource) { return true; } // admin can access everything
}

// ── PATTERN 3: BUILDER (SAMI DAHMOUNI) ──
// Builds a MedicalRecord object step by step.
// Instead of passing 7 arguments to a function, we chain methods for clarity.
class MedicalRecordBuilder {
  constructor() { this._record = {}; }

  setPatientId(id)      { this._record.patient_id = id; return this; }
  setDoctorId(id)       { this._record.doctor_id = id; return this; }
  setAppointmentId(id)  { this._record.appointment_id = id || null; return this; }
  setDiagnosis(d)       { this._record.diagnosis = d; return this; }
  setTreatment(t)       { this._record.treatment = t; return this; }
  setNotes(n)           { this._record.notes = n; return this; }
  setDate(d)            { this._record.record_date = d || new Date().toISOString().split('T')[0]; return this; }

  build() {
    if (!this._record.patient_id) throw new Error('patient_id is required');
    if (!this._record.doctor_id)  throw new Error('doctor_id is required');
    if (!this._record.record_date) this._record.record_date = new Date().toISOString().split('T')[0];
    return { ...this._record };
  }
}

// ── PATTERN 4: FACADE (NASSIM BOUKAHOUL) ──
// Provides a simple interface for complex multi-step operations.
// Instead of calling 5 different functions, you call one Facade method.
class HospitalFacade {
  // Registers a patient — creates user + patient profile in one transaction
  static async registerPatient(db, userData, patientData) {
    const bcrypt = require('bcryptjs');
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const hash = await bcrypt.hash(userData.password, 10);
      const [userResult] = await conn.query(
        'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?,?,?,?,?)',
        [userData.name, userData.email, hash, 'patient', userData.phone || null]
      );
      const userId = userResult.insertId;
      const [patResult] = await conn.query(
        'INSERT INTO patients (user_id, date_of_birth, blood_type, phone, address, insurance_provider, insurance_number) VALUES (?,?,?,?,?,?,?)',
        [userId, patientData.date_of_birth||null, patientData.blood_type||null,
         patientData.phone||null, patientData.address||null,
         patientData.insurance_provider||null, patientData.insurance_number||null]
      );
      await conn.commit();
      return { userId, patientId: patResult.insertId };
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  }

  // Books an appointment and checks for conflicts in one call
  static async bookAppointment(db, patientId, doctorId, scheduledAt, notes) {
    const [conflict] = await db.query(
      "SELECT id FROM appointments WHERE doctor_id=? AND scheduled_at=? AND status!='cancelled'",
      [doctorId, scheduledAt]
    );
    if (conflict.length) throw new Error('This time slot is already booked. Please choose another.');
    const [result] = await db.query(
      'INSERT INTO appointments (patient_id, doctor_id, scheduled_at, notes) VALUES (?,?,?,?)',
      [patientId, doctorId, scheduledAt, notes || null]
    );
    return result.insertId;
  }

  // Admits a patient — creates admission and marks room as occupied
  static async admitPatient(db, patientId, roomId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [room] = await conn.query('SELECT status FROM rooms WHERE id=?', [roomId]);
      if (!room.length || room[0].status !== 'available') throw new Error('Room is not available');
      const today = new Date().toISOString().split('T')[0];
      const [result] = await conn.query(
        'INSERT INTO admissions (patient_id, room_id, admitted_at) VALUES (?,?,?)',
        [patientId, roomId, today]
      );
      await conn.query("UPDATE rooms SET status='occupied' WHERE id=?", [roomId]);
      await conn.commit();
      return result.insertId;
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  }
}

// ── PATTERN 5: PROXY (SAMI DAHMOUNI) ──
// Controls access to medical records based on the user's role.
// Acts as a gatekeeper — the real data only passes through if allowed.
class MedicalRecordProxy {
  // Returns true if the user is allowed to see this record
  static canAccess(userRole, userId, record) {
    if (userRole === 'admin')        return true;
    if (userRole === 'doctor')       return true;
    if (userRole === 'nurse')        return true;  // nurses can view records
    if (userRole === 'patient')      return record.patient_user_id === userId;
    if (userRole === 'receptionist') return false; // receptionists can't see medical records
    return false;
  }

  // Removes sensitive fields for certain roles
  static filterFields(userRole, record) {
    if (userRole === 'patient') {
      // patients don't need to see doctor_id (internal DB field)
      const { doctor_id, ...safe } = record;
      return safe;
    }
    return record;
  }

  // Filter an array of records based on role
  static filterRecords(userRole, userId, records) {
    return records
      .filter(r => MedicalRecordProxy.canAccess(userRole, userId, r))
      .map(r => MedicalRecordProxy.filterFields(userRole, r));
  }
}

// ── PATTERN 6: STATE (ABDENNOUR OUSSAID) ──
// Manages appointment status transitions.
// Each status has rules about what transitions are allowed.
class AppointmentContext {
  constructor(status) {
    this.status = status || 'scheduled';
  }

  getStatus() { return this.status; }

  // Transition to completed
  complete() {
    if (this.status === 'cancelled')  throw new Error('Cannot complete a cancelled appointment');
    if (this.status === 'completed')  throw new Error('Appointment is already completed');
    this.status = 'completed';
    return this.status;
  }

  // Transition to cancelled
  cancel() {
    if (this.status === 'completed')  throw new Error('Cannot cancel a completed appointment');
    if (this.status === 'cancelled')  throw new Error('Appointment is already cancelled');
    this.status = 'cancelled';
    return this.status;
  }

  // Reschedule (back to scheduled)
  reschedule() {
    if (this.status === 'completed')  throw new Error('Cannot reschedule a completed appointment');
    this.status = 'scheduled';
    return this.status;
  }

  // Check what transitions are allowed from current state
  allowedTransitions() {
    const map = {
      scheduled: ['completed', 'cancelled'],
      completed: [],
      cancelled: ['scheduled'],
    };
    return map[this.status] || [];
  }
}

module.exports = {
  HospitalConfig,
  UserFactory,
  MedicalRecordBuilder,
  HospitalFacade,
  MedicalRecordProxy,
  AppointmentContext,
};
