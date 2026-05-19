const bcrypt = require('bcryptjs');
const { UserFactory, HospitalFacade } = require('../patterns');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

async function register(req, res) {
  const { name, email, password, role, phone, date_of_birth, blood_type, address, insurance_provider, insurance_number } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [exists] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length) { await conn.rollback(); return res.status(409).json({ error: 'Email already in use' }); }

    const hash = await bcrypt.hash(password, 10);
    const userRole = role || 'patient';
    const [r] = await conn.query(
      'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?,?,?,?,?)',
      [name.trim(), email.trim().toLowerCase(), hash, userRole, phone || null]
    );
    const userId = r.insertId;

    // Factory pattern: create user object based on role
    const userObj = UserFactory.create(userRole, { name, email, role: userRole });

    if (userRole === 'patient') {
      await conn.query(
        'INSERT INTO patients (user_id, date_of_birth, blood_type, phone, address, insurance_provider, insurance_number) VALUES (?,?,?,?,?,?,?)',
        [userId, date_of_birth || null, blood_type || null, phone || null, address || null, insurance_provider || null, insurance_number || null]
      );
    } else if (userRole === 'doctor') {
      await conn.query('INSERT INTO doctors (user_id, department_id) VALUES (?, 5)', [userId]);
    }

    await conn.commit();
    res.status(201).json({ message: 'Account created successfully' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally { conn.release(); }
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    let profileId = null;
    if (user.role === 'patient') {
      const [p] = await db.query('SELECT id FROM patients WHERE user_id = ?', [user.id]);
      if (p.length) profileId = p[0].id;
    } else if (user.role === 'doctor') {
      const [d] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
      if (d.length) profileId = d[0].id;
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, profileId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profileId } });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

module.exports = { register, login };
