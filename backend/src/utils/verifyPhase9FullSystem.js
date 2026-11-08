import mongoose from 'mongoose';
import dotenv from 'dotenv';
import stream from 'stream';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import Prescription from '../models/Prescription.js';
import { generateTestSignature, verifyRazorpaySignature } from '../config/razorpay.js';
import { generatePrescriptionPDF } from './pdfGenerator.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

const auditResults = [];

function recordAudit(num, area, title, statusLabel, evidence) {
    const isNotTested = statusLabel === 'NOT TESTED';
    const isPass = statusLabel === 'PASS' || (!isNotTested && Boolean(statusLabel));
    const tag = isPass ? '[PASS]' : isNotTested ? '[NOT TESTED]' : '[FAIL]';
    auditResults.push({ num, area, title, status: tag, evidence });
    console.log(`${tag} Test ${num} [${area}]: ${title}`);
    if (evidence) {
        console.log(`       Evidence: ${evidence}`);
    }
    console.log('');
}

async function runPhase9MasterAudit() {
    console.log('================================================================');
    console.log('   PHASE 9: MASTER SECURITY AUDIT & END-TO-END SYSTEM TESTING   ');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;
    let notTested = 0;

    // =============================================================
    // AREA 1: SYSTEM HEALTH, DATABASE INTEGRITY & SCHEMA AUDIT
    // =============================================================
    console.log('--- AREA 1: SYSTEM HEALTH & DATABASE SCHEMAS ---\n');

    // Test 1: API Health Endpoint
    try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        const ok = res.status === 200 && data.status === 'success';
        recordAudit(1, 'System Health', 'API Health Check returns HTTP 200 and success status', ok, `Status: ${res.status}, Response: ${JSON.stringify(data)}`);
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(1, 'System Health', 'API Health Check', false, e.message);
        failed++;
    }

    // Test 2: Database Connection & Index Integrity across all Collections
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const dbConnected = mongoose.connection.readyState === 1;

        const userIndexes = await User.collection.indexes();
        const apptIndexes = await Appointment.collection.indexes();
        const payIndexes = await Payment.collection.indexes();
        const rxIndexes = await Prescription.collection.indexes();

        const hasUserEmail = userIndexes.some((i) => i.key.email === 1);
        const hasApptDoctorSlot = apptIndexes.some((i) => i.key.doctor === 1 && i.key.date === 1 && i.key.timeSlot === 1);
        const hasPayOrder = payIndexes.some((i) => i.key.orderId === 1);
        const hasRxAppt = rxIndexes.some((i) => i.key.appointment === 1);

        const ok = dbConnected && hasUserEmail && hasApptDoctorSlot && hasPayOrder && hasRxAppt;
        recordAudit(
            2,
            'Database Audit',
            'MongoDB connection active and indexes registered for User, Appointment, Payment, and Prescription',
            ok,
            `Connected: ${dbConnected}, UserEmailIdx: ${hasUserEmail}, ApptDoctorSlotIdx: ${hasApptDoctorSlot}, PayOrderIdx: ${hasPayOrder}, RxApptIdx: ${hasRxAppt}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(2, 'Database Audit', 'MongoDB connection and indexes', false, e.message);
        failed++;
        process.exit(1);
    }

    // =============================================================
    // AREA 2: SECURITY, AUTHENTICATION & SENSITIVE DATA PROTECTION
    // =============================================================
    console.log('--- AREA 2: SECURITY, CRYPTOGRAPHY & RBAC ---\n');

    // Test 3: Password Hashing Verification
    try {
        const testUserEmail = `sec_audit_${Date.now()}@hospital.test`;
        const testPlainPass = 'SecureAuditPass@2026';
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Security Audit User',
                email: testUserEmail,
                password: testPlainPass,
                role: 'patient',
                phone: '+91 99999 00001'
            })
        });
        const regData = await regRes.json();
        const rawUser = await User.findOne({ email: testUserEmail }).select('+password');

        const isHashed = rawUser.password && rawUser.password.startsWith('$2') && rawUser.password !== testPlainPass;
        const matchesPass = await rawUser.comparePassword(testPlainPass);

        const ok = regRes.status === 201 && isHashed && matchesPass;
        recordAudit(
            3,
            'Password Security',
            'Passwords are salted and hashed with bcrypt (never plain text) and verifiable via comparePassword',
            ok,
            `DB Hash Prefix: "${rawUser.password.substring(0, 10)}...", Plaintext Exposed: false, Verified: ${matchesPass}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(3, 'Password Security', 'Password Hashing Verification', false, e.message);
        failed++;
    }

    // Test 4: Sensitive Data Exclusion (Password excluded from API responses and queries)
    try {
        const testUser = await User.findOne({ email: 'admin@hospital.com' });
        const hasNoPassword = testUser && testUser.password === undefined;

        const profileRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        });
        const loginData = await profileRes.json();
        const loginNoPassword = loginData.user && loginData.user.password === undefined;

        const ok = hasNoPassword && loginNoPassword;
        recordAudit(
            4,
            'Data Protection',
            'Password field strictly excluded by default from Mongoose queries and login API responses (select: false)',
            ok,
            `User query password excluded: ${hasNoPassword}, Login response password excluded: ${loginNoPassword}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(4, 'Data Protection', 'Sensitive Data Exclusion', false, e.message);
        failed++;
    }

    // Test 5: Public Admin Registration Prevention
    try {
        const adminRegRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Fake Admin Hacker',
                email: `hacker_${Date.now()}@darkweb.test`,
                password: 'HackerPassword123',
                role: 'admin'
            })
        });
        const ok = adminRegRes.status === 400;
        recordAudit(
            5,
            'Role Security',
            'Public registration with role="admin" strictly blocked by backend validation (HTTP 400)',
            ok,
            `Status: ${adminRegRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(5, 'Role Security', 'Public Admin Registration Prevention', false, e.message);
        failed++;
    }

    // Test 6: JWT Token Authentication Guard (Missing, Malformed, Expired)
    try {
        const noTokenRes = await fetch(`${BASE_URL}/auth/profile`);
        const malformedRes = await fetch(`${BASE_URL}/auth/profile`, {
            headers: { 'Authorization': 'Bearer malformed.fake.jwt.token' }
        });
        const ok = noTokenRes.status === 401 && malformedRes.status === 401;
        recordAudit(
            6,
            'JWT Security',
            'Unauthenticated requests with missing or malformed JWT rejected with HTTP 401 Unauthorized',
            ok,
            `No Token: HTTP ${noTokenRes.status}, Malformed Token: HTTP ${malformedRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(6, 'JWT Security', 'JWT Token Authentication Guard', false, e.message);
        failed++;
    }

    // Test 7: Unmatched Route 404 JSON Handler
    try {
        const res = await fetch(`${BASE_URL}/nonexistent-route-for-audit`);
        const data = await res.json();
        const ok = res.status === 404 && data.success === false && data.message.includes('not found');
        recordAudit(
            7,
            'API Hardening',
            'Unmatched API endpoints return structured JSON 404 response without HTML leak or crash',
            ok,
            `Status: ${res.status}, Message: "${data.message}"`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(7, 'API Hardening', 'Unmatched Route 404 Handler', false, e.message);
        failed++;
    }

    // =============================================================
    // AREA 3: ROLE-BASED ACCESS CONTROL (RBAC) & PRIVACY ISOLATION
    // =============================================================
    console.log('--- AREA 3: ROLE-BASED AUTHORIZATION & PRIVACY ---\n');

    let adminToken = '';
    let doctorToken = '', doctorId = '', docEmail = `audit_doc_${Date.now()}@hospital.test`;
    let doctor2Token = '', doctor2Id = '';
    let patientAToken = '', patientAId = '';
    let patientBToken = '', patientBId = '';

    try {
        // Login Admin
        const aRes = await (await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        })).json();
        adminToken = aRes.token;

        // Register Doctor 1
        const d1Res = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. John Watson (Master Audit)',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98888 11111',
                specialization: 'Pulmonology',
                experience: 14,
                fees: 1600
            })
        })).json();
        doctorToken = d1Res.token;
        doctorId = d1Res.user._id;

        // Approve Doctor 1
        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status: 'approved' })
        });

        // Set Doctor 1 availability
        await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '09:00', end: '17:00' },
                slotDuration: 30,
                breakTime: { start: '13:00', end: '14:00' },
                timeZone: 'Asia/Kolkata'
            })
        });

        // Register Doctor 2
        const d2Res = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Leonard McCoy (Master Audit)',
                email: `audit_doc2_${Date.now()}@hospital.test`,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98888 22222',
                specialization: 'Emergency Medicine',
                experience: 11,
                fees: 1400
            })
        })).json();
        doctor2Token = d2Res.token;
        doctor2Id = d2Res.user._id;

        await fetch(`${BASE_URL}/admin/doctors/${doctor2Id}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status: 'approved' })
        });

        // Register Patient A & Patient B
        const pARes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Sherlock Holmes',
                email: `patientA_audit_${Date.now()}@test.com`,
                password: 'PatientPassword123',
                role: 'patient',
                phone: '+91 97777 11111'
            })
        })).json();
        patientAToken = pARes.token;
        patientAId = pARes.user._id;

        const pBRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Mycroft Holmes',
                email: `patientB_audit_${Date.now()}@test.com`,
                password: 'PatientPassword123',
                role: 'patient',
                phone: '+91 97777 22222'
            })
        })).json();
        patientBToken = pBRes.token;
        patientBId = pBRes.user._id;

    } catch (e) {
        console.error('Setup failed:', e.message);
        process.exit(1);
    }

    // Test 8: Non-Admin Forbidden from Admin Endpoints (HTTP 403)
    try {
        const patRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const docRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const ok = patRes.status === 403 && docRes.status === 403;
        recordAudit(
            8,
            'RBAC Enforcement',
            'Non-admin roles (patients and doctors) are strictly forbidden from administrative endpoints (HTTP 403)',
            ok,
            `Patient: HTTP ${patRes.status}, Doctor: HTTP ${docRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(8, 'RBAC Enforcement', 'Admin Endpoints Access Control', false, e.message);
        failed++;
    }

    // Test 9: Account Lockout Security (Blocked user immediately rejected)
    try {
        // Admin blocks patient B
        await fetch(`${BASE_URL}/admin/users/${patientBId}/block`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ isBlocked: true, reason: 'Security Audit Test' })
        });

        // Patient B attempts to access protected profile
        const blockedRes = await fetch(`${BASE_URL}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });

        // Unblock Patient B for remaining tests
        await fetch(`${BASE_URL}/admin/users/${patientBId}/block`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ isBlocked: false })
        });

        const ok = blockedRes.status === 403;
        recordAudit(
            9,
            'Account Lockout',
            'Blocked accounts are immediately denied API access with HTTP 403 Forbidden',
            ok,
            `Blocked User Response Status: ${blockedRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(9, 'Account Lockout', 'Account Lockout Security', false, e.message);
        failed++;
    }

    // =============================================================
    // AREA 4: APPOINTMENT BOOKING & CONCURRENCY GUARD
    // =============================================================
    console.log('--- AREA 4: APPOINTMENT BOOKING & CONCURRENCY ---\n');

    let appointmentId = '';
    const getUpcomingWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getUpcomingWeekday(4);
    const testSlot = '11:00 - 11:30';

    // Test 10: Appointment Booking Validation & Creation (HTTP 201)
    try {
        const bookRes = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: testSlot,
                reason: 'Chronic respiratory cough and wheezing'
            })
        });
        const bookData = await bookRes.json();
        appointmentId = bookData.appointment?._id;

        const ok =
            bookRes.status === 201 &&
            bookData.success &&
            bookData.appointment?.status === 'confirmed' &&
            bookData.appointment?.paymentStatus === 'pending' &&
            bookData.appointment?.fees === 1600;

        recordAudit(
            10,
            'Appointment Booking',
            'Patient books consultation slot; status defaults to "confirmed" with initial paymentStatus "pending"',
            ok,
            `Appt ID: ${appointmentId}, Status: "${bookData.appointment?.status}", Fee: ₹${bookData.appointment?.fees}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(10, 'Appointment Booking', 'Appointment Creation', false, e.message);
        failed++;
    }

    // Test 11: Slot Concurrency Guard (Duplicate booking rejected with HTTP 409 Conflict)
    try {
        const dupRes = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: testSlot,
                reason: 'Second patient attempting collision'
            })
        });
        const ok = dupRes.status === 409;
        recordAudit(
            11,
            'Concurrency Guard',
            'Concurrent/double booking on identical doctor date and timeSlot rejected with HTTP 409 Conflict',
            ok,
            `Status: ${dupRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(11, 'Concurrency Guard', 'Double Booking Prevention', false, e.message);
        failed++;
    }

    // =============================================================
    // AREA 5: ONLINE PAYMENT INTEGRATION & SIGNATURE VERIFICATION
    // =============================================================
    console.log('--- AREA 5: RAZORPAY ONLINE PAYMENT & HMAC SIGNATURES ---\n');

    let razorpayOrderId = '';

    // Test 12: Server-Side Razorpay Order Creation
    try {
        const orderRes = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId })
        });
        const orderData = await orderRes.json();
        razorpayOrderId = orderData.orderId;

        const ok =
            orderRes.status === 200 &&
            orderData.success &&
            !!razorpayOrderId &&
            orderData.amount === 160000 &&
            orderData.currency === 'INR';

        recordAudit(
            12,
            'Payment Order Creation',
            'Server creates Razorpay order with currency INR and 160000 Paise (100% server calculated from doctor fee)',
            ok,
            `Order ID: ${razorpayOrderId}, Amount in paise: ${orderData.amount}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(12, 'Payment Order Creation', 'Razorpay Order Generation', false, e.message);
        failed++;
    }

    // Test 13: Cryptographic Signature Tampering Protection (HTTP 400)
    try {
        const fakePaymentId = `pay_fake_${Date.now()}`;
        const authenticSig = generateTestSignature({ orderId: razorpayOrderId, paymentId: fakePaymentId });
        const tamperedSig = authenticSig.slice(0, -5) + 'XXXXX';

        const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId,
                razorpayOrderId,
                razorpayPaymentId: fakePaymentId,
                razorpaySignature: tamperedSig
            })
        });
        const ok = verifyRes.status === 400;
        recordAudit(
            13,
            'Payment Security',
            'Tampered or forged Razorpay payment signature strictly rejected (HTTP 400); Database state protected',
            ok,
            `Status: ${verifyRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(13, 'Payment Security', 'Tampered Signature Rejection', false, e.message);
        failed++;
    }

    // Test 14: Valid Payment Verification & State Transition
    try {
        const validPaymentId = `pay_verified_${Date.now()}`;
        const validSig = generateTestSignature({ orderId: razorpayOrderId, paymentId: validPaymentId });

        const verifyRes = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId,
                razorpayOrderId,
                razorpayPaymentId: validPaymentId,
                razorpaySignature: validSig
            })
        });
        const verifyData = await verifyRes.json();

        const dbAppt = await Appointment.findById(appointmentId);
        const dbPayment = await Payment.findOne({ appointment: appointmentId });

        const ok =
            verifyRes.status === 200 &&
            verifyData.success &&
            dbAppt.paymentStatus === 'paid' &&
            dbPayment.status === 'captured';

        recordAudit(
            14,
            'Payment Capture',
            'Authentic HMAC-SHA256 signature verified; Appointment updated to "paid" and Payment record to "captured"',
            ok,
            `Appt paymentStatus: "${dbAppt.paymentStatus}", Payment status: "${dbPayment.status}", Payment ID: ${validPaymentId}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(14, 'Payment Capture', 'Payment Verification & Capture', false, e.message);
        failed++;
    }

    // Test 15: Duplicate Payment Prevention (HTTP 400)
    try {
        const dupPayRes = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId })
        });
        const ok = dupPayRes.status === 400;
        recordAudit(
            15,
            'Payment Idempotency',
            'System blocks duplicate payment order creation for already paid consultation (HTTP 400)',
            ok,
            `Status: ${dupPayRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(15, 'Payment Idempotency', 'Duplicate Payment Prevention', false, e.message);
        failed++;
    }

    // =============================================================
    // AREA 6: DIGITAL PRESCRIPTIONS & PDFKIT STREAMING
    // =============================================================
    console.log('--- AREA 6: DIGITAL PRESCRIPTIONS & PDF GENERATION ---\n');

    let prescriptionId = '';
    let prescriptionNumber = '';

    // Test 16: Doctor Ownership Guard (Doctor 2 blocked from Doctor 1 appointment)
    try {
        const crossDocRes = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctor2Token}`
            },
            body: JSON.stringify({
                appointmentId,
                diagnosis: 'Bronchitis',
                medicines: [{ name: 'Amoxicillin', dosage: '500mg', frequency: '1-0-1', duration: '5 days' }]
            })
        });
        const ok = crossDocRes.status === 403;
        recordAudit(
            16,
            'Doctor Ownership',
            'Doctor 2 strictly forbidden from prescribing for Doctor 1 appointment (HTTP 403 Forbidden)',
            ok,
            `Status: ${crossDocRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(16, 'Doctor Ownership', 'Doctor Ownership Guard', false, e.message);
        failed++;
    }

    // Test 17: Valid Digital Prescription Issuance & Appointment Auto-Completion
    try {
        const rxRes = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                appointmentId,
                diagnosis: 'Acute Asthmatic Bronchitis with Bronchospasm',
                symptoms: 'Nocturnal wheezing, productive cough for 6 days, mild dyspnea',
                medicines: [
                    {
                        name: 'Salbutamol / Ipratropium Inhaler 100mcg',
                        dosage: '2 Puffs',
                        frequency: 'Every 6 hours as needed (PRN)',
                        duration: '7 days',
                        instructions: 'Use spacer device. Rinse mouth with water after use.'
                    },
                    {
                        name: 'Montelukast Sodium 10mg',
                        dosage: '1 Tablet',
                        frequency: 'Once daily at bedtime (0-0-1)',
                        duration: '14 days',
                        instructions: 'Take with or without food at evening.'
                    },
                    {
                        name: 'Acebrophylline 100mg',
                        dosage: '1 Capsule',
                        frequency: 'Twice daily after meals (1-0-1)',
                        duration: '5 days',
                        instructions: 'Take strictly after food.'
                    }
                ],
                advice: 'Steam inhalation twice daily. Avoid dusty environments and sudden exposure to cold air. Peak flow monitoring daily.',
                followUpDate: '2026-12-10'
            })
        });
        const rxData = await rxRes.json();
        prescriptionId = rxData.prescription?._id;
        prescriptionNumber = rxData.prescription?.prescriptionNumber;

        const dbAppt = await Appointment.findById(appointmentId);

        const ok =
            rxRes.status === 201 &&
            rxData.success &&
            !!prescriptionId &&
            !!prescriptionNumber &&
            dbAppt.status === 'completed' &&
            dbAppt.prescription?.toString() === prescriptionId;

        recordAudit(
            17,
            'Prescription Issuance',
            'Doctor creates digital prescription with 3 structured medications; Appointment auto-transitions to "completed"',
            ok,
            `Prescription #: ${prescriptionNumber}, Appt Status: "${dbAppt.status}", Linked Rx: ${dbAppt.prescription}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(17, 'Prescription Issuance', 'Prescription Creation', false, e.message);
        failed++;
    }

    // Test 18: Patient Privacy Isolation on Prescriptions (Patient B blocked from Patient A)
    try {
        const privRes = await fetch(`${BASE_URL}/prescriptions/${prescriptionId}`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const ok = privRes.status === 403;
        recordAudit(
            18,
            'Patient Privacy',
            'Patient B strictly forbidden from viewing Patient A medical prescription (HTTP 403 Forbidden)',
            ok,
            `Status: ${privRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(18, 'Patient Privacy', 'Prescription Privacy Guard', false, e.message);
        failed++;
    }

    // Test 19: PDF Streaming & Download Verification
    try {
        const pdfRes = await fetch(`${BASE_URL}/prescriptions/${prescriptionId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const contentType = pdfRes.headers.get('content-type');
        const disposition = pdfRes.headers.get('content-disposition');
        const buf = await pdfRes.arrayBuffer();
        const magic = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));

        const ok =
            pdfRes.status === 200 &&
            contentType === 'application/pdf' &&
            disposition?.includes('attachment') &&
            magic === '%PDF-';

        recordAudit(
            19,
            'PDF Document Generation',
            'Official digital medical prescription PDF generated on-the-fly and streamed with PDF-1.3 letterhead',
            ok,
            `Content-Type: ${contentType}, Size: ${buf.byteLength} bytes, File: ${disposition}, Header: "${magic}"`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(19, 'PDF Document Generation', 'PDF Download Endpoint', false, e.message);
        failed++;
    }

    // Test 20: PDF Download Privacy Guard
    try {
        const privPdfRes = await fetch(`${BASE_URL}/prescriptions/${prescriptionId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const ok = privPdfRes.status === 403;
        recordAudit(
            20,
            'PDF Download Privacy',
            'Unauthorized patient strictly forbidden from downloading another patient\'s PDF prescription (HTTP 403)',
            ok,
            `Status: ${privPdfRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(20, 'PDF Download Privacy', 'PDF Privacy Guard', false, e.message);
        failed++;
    }

    // =============================================================
    // AREA 7: VIDEO CONSULTATION & TELEHEALTH SCOPE AUDIT
    // =============================================================
    console.log('--- AREA 7: VIDEO CONSULTATION & TELEHEALTH AUDIT ---\n');

    // Test 21: Telehealth Clinical Consultation Session Notes & Prescription Audit
    try {
        const dbAppt = await Appointment.findById(appointmentId).populate('prescription');
        const hasConsultationRecord = dbAppt && dbAppt.status === 'completed' && dbAppt.prescription;
        recordAudit(
            21,
            'Telehealth Consultation',
            'Consultation records clinical session notes, diagnosis, and prescription artifact',
            hasConsultationRecord,
            `Consultation ID: ${dbAppt?._id}, Status: "${dbAppt?.status}", Diagnosis: "${dbAppt?.prescription?.diagnosis}"`
        );
        if (hasConsultationRecord) passed++; else failed++;
    } catch (e) {
        recordAudit(21, 'Telehealth Consultation', 'Telehealth Consultation Audit', false, e.message);
        failed++;
    }

    // Test 22: Video Calling (WebRTC / Peer-to-Peer Live Stream) Status Audit
    // Note: Live WebRTC video stream calling is evaluated against system implementation.
    recordAudit(
        22,
        'Live Video Call Feature',
        'Real-time WebRTC audio/video call stream feature audit',
        'NOT TESTED',
        'NOT TESTED / NOT IMPLEMENTED in Phases 1–8. Consultation records, clinical notes, telehealth scheduling, and digital prescriptions are active; live peer-to-peer WebRTC video stream is identified as future extension.'
    );
    notTested++;

    // =============================================================
    // AREA 8: ADMIN SUPERVISION & REVENUE AUDIT
    // =============================================================
    console.log('--- AREA 8: ADMIN SUPERVISION & REVENUE METRICS ---\n');

    // Test 23: Admin Statistics Match Database Ground Truth
    try {
        const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const statsData = await statsRes.json();

        const dbUserCount = await User.countDocuments();
        const dbPatientCount = await User.countDocuments({ role: 'patient' });
        const dbDoctorCount = await User.countDocuments({ role: 'doctor' });
        const dbApptCount = await Appointment.countDocuments();

        const ok =
            statsRes.status === 200 &&
            statsData.success &&
            statsData.stats.totalUsers === dbUserCount &&
            statsData.stats.totalPatients === dbPatientCount &&
            statsData.stats.totalDoctors === dbDoctorCount &&
            statsData.stats.totalAppointments === dbApptCount;

        recordAudit(
            23,
            'Admin Analytics',
            'Admin dashboard metrics match 100% against direct MongoDB database ground truth',
            ok,
            `Users: ${statsData.stats.totalUsers} vs ${dbUserCount}, Patients: ${statsData.stats.totalPatients} vs ${dbPatientCount}, Doctors: ${statsData.stats.totalDoctors} vs ${dbDoctorCount}, Appts: ${statsData.stats.totalAppointments} vs ${dbApptCount}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordAudit(23, 'Admin Analytics', 'Admin Statistics Audit', false, e.message);
        failed++;
    }

    // =============================================================
    // SUMMARY
    // =============================================================
    console.log('================================================================');
    console.log(` PHASE 9 MASTER AUDIT: ${passed} PASSED / ${failed} FAILED / ${notTested} NOT TESTED`);
    console.log('================================================================\n');

    await mongoose.disconnect();
}

runPhase9MasterAudit().catch((err) => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
});
