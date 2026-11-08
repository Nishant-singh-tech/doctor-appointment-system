import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api/auth';

const results = [];

function recordTest(testName, passed, evidence) {
    results.push({ testName, passed, evidence });
    const status = passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${testName}`);
    console.log(`       Evidence: ${evidence}`);
}

async function runVerification() {
    console.log('=====================================================');
    console.log('   INDEPENDENT VERIFICATION FOR PHASE 2 AUTH SUITE   ');
    console.log('=====================================================\n');

    // 11. Backend Startup & MongoDB Connection Check
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const isConnected = mongoose.connection.readyState === 1;
        recordTest(
            '11. Backend startup and MongoDB connection',
            isConnected,
            `Mongoose connection readyState = ${mongoose.connection.readyState} (Host: ${mongoose.connection.host})`
        );
    } catch (err) {
        recordTest('11. Backend startup and MongoDB connection', false, err.message);
        process.exit(1);
    }

    // 8. Prevention of Public Admin Registration
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Unauthorized Admin Candidate',
                email: `admin_attempt_${Date.now()}@test.com`,
                password: 'SecretPassword123',
                role: 'admin'
            })
        });
        const data = await res.json();
        const prevented = res.status === 400 && data.success === false;
        recordTest(
            '8. Prevention of public admin registration',
            prevented,
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (err) {
        recordTest('8. Prevention of public admin registration', false, err.message);
    }

    // 1. Patient Registration & Login
    const patientEmail = `patient_verify_${Date.now()}@test.com`;
    const patientPassword = 'TestPatientPass123';
    let patientToken = '';
    let patientId = '';

    try {
        // Register Patient
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Verify Patient',
                email: patientEmail,
                password: patientPassword,
                role: 'patient',
                phone: '5551234567'
            })
        });
        const regData = await regRes.json();
        const regSuccess = regRes.status === 201 && regData.token && regData.user.role === 'patient';
        patientId = regData.user._id;

        // Login Patient
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: patientEmail,
                password: patientPassword
            })
        });
        const loginData = await loginRes.json();
        patientToken = loginData.token;
        const loginSuccess = loginRes.status === 200 && loginData.token && loginData.user.role === 'patient';

        recordTest(
            '1. Patient registration and login',
            regSuccess && loginSuccess,
            `Registration HTTP ${regRes.status} (token received); Login HTTP ${loginRes.status} (token verified)`
        );
    } catch (err) {
        recordTest('1. Patient registration and login', false, err.message);
    }

    // 2. Doctor Registration & Login
    const doctorEmail = `doctor_verify_${Date.now()}@test.com`;
    const doctorPassword = 'TestDoctorPass123';
    let doctorToken = '';

    try {
        // Register Doctor
        const regRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Verify Specialist',
                email: doctorEmail,
                password: doctorPassword,
                role: 'doctor',
                phone: '5559876543',
                specialization: 'Neurology',
                experience: 15,
                fees: 750
            })
        });
        const regData = await regRes.json();
        const regSuccess = regRes.status === 201 && regData.user.role === 'doctor' && regData.user.isVerified === false;

        // Login Doctor
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: doctorEmail,
                password: doctorPassword
            })
        });
        const loginData = await loginRes.json();
        doctorToken = loginData.token;
        const loginSuccess = loginRes.status === 200 && loginData.token && loginData.user.role === 'doctor';

        recordTest(
            '2. Doctor registration and login',
            regSuccess && loginSuccess,
            `Doctor registration HTTP ${regRes.status} (Specialization: ${regData.user.specialization}, isVerified: ${regData.user.isVerified}); Login HTTP ${loginRes.status}`
        );
    } catch (err) {
        recordTest('2. Doctor registration and login', false, err.message);
    }

    // 3. Password Hashing in MongoDB
    try {
        const storedUser = await User.findById(patientId).select('+password');
        const isBcrypt = storedUser.password.startsWith('$2') && storedUser.password.length === 60;
        const isNotPlainText = storedUser.password !== patientPassword;

        recordTest(
            '3. Password hashing in MongoDB',
            isBcrypt && isNotPlainText,
            `Password in DB is 60-character bcrypt hash starting with "${storedUser.password.substring(0, 7)}...". Plain text is never stored.`
        );
    } catch (err) {
        recordTest('3. Password hashing in MongoDB', false, err.message);
    }

    // 4. Rejection of Incorrect Passwords
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: patientEmail,
                password: 'IncorrectPasswordValue999'
            })
        });
        const data = await res.json();
        const rejected = res.status === 401 && data.success === false;

        recordTest(
            '4. Rejection of incorrect passwords',
            rejected,
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (err) {
        recordTest('4. Rejection of incorrect passwords', false, err.message);
    }

    // 5. GET /api/auth/profile with a Valid JWT
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${patientToken}`
            }
        });
        const data = await res.json();
        const valid = res.status === 200 && data.success === true && data.user.email === patientEmail;

        recordTest(
            '5. GET /api/auth/profile with a valid JWT',
            valid,
            `HTTP ${res.status}: Successfully returned user profile for ${data.user.email} (Role: ${data.user.role})`
        );
    } catch (err) {
        recordTest('5. GET /api/auth/profile with a valid JWT', false, err.message);
    }

    // 6. Rejection of Missing, Invalid, and Expired Tokens
    try {
        // Missing token
        const missingRes = await fetch(`${BASE_URL}/profile`);
        const missingData = await missingRes.json();
        const missingPass = missingRes.status === 401 && missingData.success === false;

        // Invalid token
        const invalidRes = await fetch(`${BASE_URL}/profile`, {
            headers: { 'Authorization': 'Bearer forged.tampered.token' }
        });
        const invalidData = await invalidRes.json();
        const invalidPass = invalidRes.status === 401 && invalidData.success === false;

        // Expired token (created with expired timestamp in the past)
        const expiredToken = jwt.sign(
            { id: patientId, role: 'patient' },
            process.env.JWT_SECRET,
            { expiresIn: '0s' }
        );
        // Wait 100ms to ensure expiration
        await new Promise((r) => setTimeout(r, 100));

        const expiredRes = await fetch(`${BASE_URL}/profile`, {
            headers: { 'Authorization': `Bearer ${expiredToken}` }
        });
        const expiredData = await expiredRes.json();
        const expiredPass = expiredRes.status === 401 && expiredData.success === false;

        const allPass = missingPass && invalidPass && expiredPass;
        recordTest(
            '6. Rejection of missing, invalid, and expired tokens',
            allPass,
            `Missing token: HTTP ${missingRes.status}; Invalid token: HTTP ${invalidRes.status}; Expired token: HTTP ${expiredRes.status} ("${expiredData.message}")`
        );
    } catch (err) {
        recordTest('6. Rejection of missing, invalid, and expired tokens', false, err.message);
    }

    // 7. Role-Based Access Control (Patient, Doctor, Admin)
    try {
        // Log in seeded admin to obtain adminToken
        const adminRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        });
        const adminData = await adminRes.json();
        const adminToken = adminData.token;

        // Test 1: Patient token accessing /patient-only (Should PASS with 200)
        const p1 = await fetch(`${BASE_URL}/patient-only`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        // Test 2: Doctor token accessing /patient-only (Should be FORBIDDEN with 403)
        const p2 = await fetch(`${BASE_URL}/patient-only`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });

        // Test 3: Doctor token accessing /doctor-only (Should PASS with 200)
        const d1 = await fetch(`${BASE_URL}/doctor-only`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });

        // Test 4: Patient token accessing /doctor-only (Should be FORBIDDEN with 403)
        const d2 = await fetch(`${BASE_URL}/doctor-only`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        // Test 5: Admin token accessing /admin-only (Should PASS with 200)
        const a1 = await fetch(`${BASE_URL}/admin-only`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        // Test 6: Patient token accessing /admin-only (Should be FORBIDDEN with 403)
        const a2 = await fetch(`${BASE_URL}/admin-only`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        const rbacSuccess =
            p1.status === 200 &&
            p2.status === 403 &&
            d1.status === 200 &&
            d2.status === 403 &&
            a1.status === 200 &&
            a2.status === 403;

        recordTest(
            '7. Role-based access control for patient, doctor, and admin',
            rbacSuccess,
            `Patient route (Patient: ${p1.status}, Doctor: ${p2.status}); Doctor route (Doctor: ${d1.status}, Patient: ${d2.status}); Admin route (Admin: ${a1.status}, Patient: ${a2.status})`
        );
    } catch (err) {
        recordTest('7. Role-based access control for patient, doctor, and admin', false, err.message);
    }

    await mongoose.disconnect();
    console.log('\n=====================================================');
    const totalPassed = results.filter((r) => r.passed).length;
    console.log(`VERIFICATION SUMMARY: ${totalPassed}/${results.length} PASSED`);
    console.log('=====================================================');

    process.exit(totalPassed === results.length ? 0 : 1);
}

runVerification();
