const router = require('express').Router();
const { auth, role } = require('../middleware/auth');
const a = require('../controllers/auth');
const c = require('../controllers/main');

// Auth
router.post('/auth/register', a.register);
router.post('/auth/login', a.login);

// Stats & Departments
router.get('/stats', auth, c.stats);
router.get('/departments', auth, c.getDepts);

// Patients
router.get('/patients', auth, c.getPatients);
router.get('/patients/:id', auth, c.getPatient);
router.put('/patients/:id', auth, role('admin','receptionist','doctor','nurse'), c.updatePatient);
router.delete('/patients/:id', auth, role('admin'), c.deletePatient);
router.patch('/patients/:id/verify-insurance', auth, role('admin','receptionist'), c.verifyInsurance);

// Doctors
router.get('/doctors', auth, c.getDoctors);

// Slots
router.get('/slots', auth, c.getSlots);

// Appointments
router.get('/appointments', auth, c.getAppointments);
router.post('/appointments', auth, role('admin','receptionist','doctor','patient'), c.createAppointment);
router.patch('/appointments/:id/status', auth, role('admin','receptionist','doctor'), c.updateStatus);
router.delete('/appointments/:id', auth, role('admin'), c.deleteAppointment);

// Medical Records
router.get('/records', auth, c.getRecords);
router.post('/records', auth, role('admin','doctor'), c.createRecord);

// Prescriptions
router.get('/prescriptions', auth, c.getPrescriptions);
router.post('/prescriptions', auth, role('admin','doctor'), c.createPrescription);

// Lab Tests
router.get('/lab-tests', auth, c.getLabTests);
router.post('/lab-tests', auth, role('admin','doctor'), c.createLabTest);
router.patch('/lab-tests/:id/result', auth, role('admin','doctor'), c.updateLabResult);

// Payments
router.get('/payments', auth, c.getPayments);
router.post('/payments', auth, role('admin','receptionist'), c.createPayment);
router.patch('/payments/:id/process', auth, role('admin','receptionist'), c.processPayment);

// Rooms & Admissions
router.get('/rooms', auth, c.getRooms);
router.get('/admissions', auth, c.getAdmissions);
router.post('/admissions', auth, role('admin','nurse'), c.admitPatient);
router.patch('/admissions/:id/discharge', auth, role('admin','nurse'), c.discharge);

module.exports = router;
