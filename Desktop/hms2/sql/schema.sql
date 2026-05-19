-- =============================================
-- MediCore Hospital Management System
-- Authors: ABDENNOUR OUSSAID, NASSIM BOUKAHOUL, SAMI DAHMOUNI
-- =============================================

DROP DATABASE IF EXISTS hms_db;
CREATE DATABASE hms_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hms_db;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','doctor','nurse','receptionist','patient') NOT NULL DEFAULT 'patient',
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT
);

CREATE TABLE doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  department_id INT,
  specialization VARCHAR(100),
  phone VARCHAR(20),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE doctor_availability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration INT DEFAULT 30,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  date_of_birth DATE,
  blood_type VARCHAR(5),
  phone VARCHAR(20),
  address TEXT,
  insurance_provider VARCHAR(100),
  insurance_number VARCHAR(50),
  insurance_status ENUM('verified','pending','not_verified') DEFAULT 'not_verified',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  scheduled_at DATETIME NOT NULL,
  duration INT DEFAULT 30,
  status ENUM('scheduled','completed','cancelled') DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE medical_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  appointment_id INT,
  diagnosis TEXT,
  treatment TEXT,
  notes TEXT,
  record_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

CREATE TABLE prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medical_record_id INT NOT NULL,
  doctor_id INT NOT NULL,
  patient_id INT NOT NULL,
  medication VARCHAR(200) NOT NULL,
  dosage VARCHAR(100),
  instructions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

CREATE TABLE lab_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  test_type VARCHAR(100) NOT NULL,
  status ENUM('ordered','in_progress','completed') DEFAULT 'ordered',
  result TEXT,
  ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);

CREATE TABLE wards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department_id INT,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_number VARCHAR(20) NOT NULL,
  ward_id INT NOT NULL,
  bed_count INT DEFAULT 1,
  status ENUM('available','occupied','maintenance') DEFAULT 'available',
  FOREIGN KEY (ward_id) REFERENCES wards(id)
);

CREATE TABLE admissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  room_id INT NOT NULL,
  admitted_at DATE NOT NULL,
  discharged_at DATE,
  status ENUM('admitted','discharged') DEFAULT 'admitted',
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appointment_id INT,
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','card','insurance','bank_transfer') DEFAULT 'cash',
  status ENUM('pending','paid','failed','insurance_pending') DEFAULT 'pending',
  insurance_covered DECIMAL(10,2) DEFAULT 0,
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);

-- =============================================
-- SEED DATA  |  password for ALL accounts = "password"
-- Hash verified: bcrypt.compareSync('password', hash) = true
-- =============================================

INSERT INTO departments (name, description) VALUES
('Cardiology','Heart and cardiovascular system'),
('Neurology','Brain and nervous system'),
('Orthopedics','Bones and joints'),
('Emergency','Emergency and trauma care'),
('General Medicine','General health and primary care');

INSERT INTO users (name, email, password_hash, role, phone) VALUES
('Admin','admin@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','admin','+48 100 000 001'),
('Dr. Anna Kowalski','anna@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','doctor','+48 100 000 002'),
('Dr. Piotr Nowak','piotr@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','doctor','+48 100 000 003'),
('Nurse Maria','maria@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','nurse','+48 100 000 004'),
('Jan Kowalczyk','jan@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','receptionist','+48 100 000 005'),
('Tomasz Wisniewski','tomasz@hms.com','$2a$10$m1N8b2lbvNMb.Db7yqa7Y.Hp.q12mo/.hfx2OnKMwGNVlzc0qS5Hy','patient','+48 100 000 006');

INSERT INTO doctors (user_id, department_id, specialization, phone) VALUES
(2, 1, 'Cardiologist', '+48 100 000 002'),
(3, 3, 'Orthopedic Surgeon', '+48 100 000 003');

INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time) VALUES
(1, 1, '09:00:00', '17:00:00'),
(1, 2, '09:00:00', '17:00:00'),
(1, 3, '09:00:00', '17:00:00'),
(1, 4, '09:00:00', '17:00:00'),
(1, 5, '09:00:00', '13:00:00'),
(2, 1, '10:00:00', '18:00:00'),
(2, 2, '10:00:00', '18:00:00'),
(2, 3, '10:00:00', '18:00:00'),
(2, 4, '10:00:00', '18:00:00');

INSERT INTO patients (user_id, date_of_birth, blood_type, phone, address, insurance_provider, insurance_number, insurance_status) VALUES
(6, '1990-05-15', 'A+', '+48 100 000 006', 'ul. Kwiatowa 1, Kielce', 'NFZ', 'NFZ-123456', 'verified');

INSERT INTO wards (name, department_id) VALUES
('Cardiology Ward A', 1),
('Orthopedics Ward B', 3),
('Emergency Ward', 4),
('General Ward', 5);

INSERT INTO rooms (room_number, ward_id, bed_count, status) VALUES
('101', 1, 2, 'available'),
('102', 1, 2, 'available'),
('201', 2, 3, 'available'),
('202', 2, 2, 'available'),
('301', 3, 4, 'available'),
('401', 4, 2, 'available'),
('402', 4, 2, 'available');
