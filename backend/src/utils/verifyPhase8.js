import mongoose from 'mongoose';
import dotenv from 'dotenv';
import stream from 'stream';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';
import { generatePrescriptionPDF } from './pdfGenerator.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

const results = [];

function recordTest(num, name, passed, evidence) {
    results.push({ num, name, passed, evidence });
    const status = passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} Test ${num}: ${name}`);
    if (evidence) {
        console.log(`       Evidence: ${evidence}`);
    }
    console.log('');
}

async function runPhase8Verification() {
    console.log('================================================================');
    console.log('   PHASE 8: DIGITAL PRESCRIPTION MANAGEMENT AUDIT & VERIFICATION');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    // -------------------------------------------------------------
    // 1. Direct MongoDB Connection & Prescription Schema Integrity
    // -------------------------------------------------------------
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const isConnected = mongoose.connection.readyState === 1;

        const rxIndexes = await Prescription.collection.indexes();
        const hasApptIndex = rxIndexes.some((idx) => idx.key.appointment === 1);
        const hasDoctorIndex = rxIndexes.some((idx) => idx.key.doctor === 1);
        const hasPatientIndex = rxIndexes.some((idx) => idx.key.patient === 1);
        const hasNumberIndex = rxIndexes.some((idx) => idx.key.prescriptionNumber === 1);

        const ok = isConnected && hasApptIndex && hasDoctorIndex && hasPatientIndex && hasNumberIndex;
        recordTest(
            1,
            'Database Connection & Prescription Model Schema Integrity',
            ok,
            `Connected: ${isConnected}, Appt index: ${hasApptIndex}, Doctor index: ${hasDoctorIndex}, Patient index: ${hasPatientIndex}, Number index: ${hasNumberIndex}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(1, 'Database Connection & Prescription Model Schema Integrity', false, err.message);
        failed++;
        process.exit(1);
    }

    // -------------------------------------------------------------
    // 2. Unit Test: PDF Generator Stream and Buffer Integrity
    // -------------------------------------------------------------
    try {
        const mockPrescription = {
            prescriptionNumber: 'RX-TEST-AUDIT-001',
            createdAt: new Date(),
            doctor: {
                name: 'Auditor Strange',
                speciality: 'Neurology',
                qualification: 'MD, DM Neurology',
                medicalRegNo: 'MCI-998822'
            },
            patient: {
                name: 'Audit Patient',
                email: 'patient@audit.com',
                phone: '+91 99999 88888',
                age: 32,
                gender: 'male'
            },
            diagnosis: 'Chronic Cluster Headache',
            symptoms: 'Excruciating unilateral peri-orbital pain',
            medicines: [
                {
                    name: 'Verapamil 80mg',
                    dosage: '1 Tab',
                    frequency: 'Three times daily',
                    duration: '14 days',
                    instructions: 'Take after meals.'
                },
                {
                    name: 'Oxygen Inhalation High Flow',
                    dosage: '100% O2 at 12 L/min',
                    frequency: 'During acute attack',
                    duration: '15 mins',
                    instructions: 'Via non-rebreather mask.'
                }
            ],
            advice: 'Avoid alcohol triggers. Maintain regular sleep routine.',
            followUpDate: '2026-12-01'
        };

        const chunks = [];
        const writableMock = new stream.Writable({
            write(chunk, encoding, callback) {
                chunks.push(chunk);
                callback();
            }
        });

        generatePrescriptionPDF(mockPrescription, writableMock);

        await new Promise((resolve, reject) => {
            writableMock.on('finish', resolve);
            writableMock.on('error', reject);
        });

        const fullBuffer = Buffer.concat(chunks);
        const magic = fullBuffer.slice(0, 5).toString('ascii');
        const ok = fullBuffer.length > 1000 && magic === '%PDF-';

        recordTest(
            2,
            'PDFKit Engine Unit: Generates valid binary PDF stream with proper PDF-1.3 header & letterhead',
            ok,
            `Buffer byteLength: ${fullBuffer.length} bytes, Header magic: "${magic}"`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(2, 'PDFKit Engine Unit', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // Setup API Testing Accounts
    // -------------------------------------------------------------
    let adminToken = '';
    let doctorToken = '', doctorId = '', docEmail = `p8_audit_doc_${Date.now()}@hospital.test`;
    let doctor2Token = '', doctor2Id = '';
    let patientAToken = '', patientAId = '';
    let patientBToken = '', patientBId = '';

    try {
        // Admin login
        const adminRes = await (await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        })).json();
        adminToken = adminRes.token;

        // Doctor 1
        const doc1Res = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Stephen Strange (Audit)',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98888 11111',
                specialization: 'Neurology',
                experience: 16,
                fees: 2500
            })
        })).json();
        doctorToken = doc1Res.token;
        doctorId = doc1Res.user._id;

        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status: 'approved' })
        });

        await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '09:00', end: '16:00' },
                slotDuration: 30,
                breakTime: { start: '12:00', end: '13:00' },
                timeZone: 'Asia/Kolkata'
            })
        });

        // Doctor 2 (for cross-doctor ownership test)
        const doc2Res = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Bruce Banner (Audit)',
                email: `p8_audit_doc2_${Date.now()}@hospital.test`,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98888 22222',
                specialization: 'Internal Medicine',
                experience: 12,
                fees: 1800
            })
        })).json();
        doctor2Token = doc2Res.token;
        doctor2Id = doc2Res.user._id;

        await fetch(`${BASE_URL}/admin/doctors/${doctor2Id}/verify`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
            body: JSON.stringify({ status: 'approved' })
        });

        // Patient A & B
        const pARes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Audit Patient A',
                email: `p8_patA_${Date.now()}@test.com`,
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
                name: 'Audit Patient B',
                email: `p8_patB_${Date.now()}@test.com`,
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

    // -------------------------------------------------------------
    // Book Appointment for Patient A
    // -------------------------------------------------------------
    let apptId = '';
    const getUpcomingWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getUpcomingWeekday(3);

    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientAToken}` },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: '10:00 - 10:30',
                reason: 'Migraine and vestibular dizziness'
            })
        });
        const d = await res.json();
        apptId = d.appointment?._id;
    } catch (e) {
        console.error('Booking failed:', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // 3. Backend Validation: Missing Diagnosis Rejected (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: '',
                medicines: [{ name: 'Paracetamol', dosage: '500mg', frequency: '1-0-1', duration: '3 days' }]
            })
        });
        const ok = res.status === 400;
        recordTest(
            3,
            'Backend Input Validation: Missing diagnosis rejected with HTTP 400 Bad Request',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(3, 'Backend Input Validation: Missing Diagnosis', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 4. Backend Validation: Empty Medicines Array Rejected (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: 'Tension Headache',
                medicines: []
            })
        });
        const ok = res.status === 400;
        recordTest(
            4,
            'Backend Input Validation: Empty medicines list rejected with HTTP 400 Bad Request',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(4, 'Backend Input Validation: Empty Medicines', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 5. Role-Based Authorization: Patient Cannot Create Prescription (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${patientAToken}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: 'Self diagnosis',
                medicines: [{ name: 'Aspirin', dosage: '100mg', frequency: '1-0-0', duration: '5 days' }]
            })
        });
        const ok = res.status === 403;
        recordTest(
            5,
            'Role-Based Authorization: Non-doctor (patient) rejected from creating prescription (HTTP 403)',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(5, 'Role-Based Authorization: Patient Blocked', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 6. Doctor Ownership Isolation: Doctor 2 Blocked from Doctor 1 Appointment (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctor2Token}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: 'Headache',
                medicines: [{ name: 'Ibuprofen', dosage: '400mg', frequency: '1-0-1', duration: '3 days' }]
            })
        });
        const ok = res.status === 403;
        recordTest(
            6,
            'Doctor Ownership Isolation: Doctor 2 strictly prohibited from prescribing for Doctor 1 appointment (HTTP 403)',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(6, 'Doctor Ownership Isolation', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 7. Legitimate Prescription Creation with Structured Clinical Data (HTTP 201)
    // -------------------------------------------------------------
    let rxId = '';
    let rxNumber = '';
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: 'Episodic Vestibular Migraine',
                symptoms: 'Rotational vertigo, photophobia, headache',
                medicines: [
                    {
                        name: 'Zolmitriptan 2.5mg',
                        dosage: '1 Tab',
                        frequency: 'At onset of headache',
                        duration: '5 days PRN',
                        instructions: 'Take with full glass of water. Do not exceed 5mg in 24 hours.'
                    },
                    {
                        name: 'Betahistine 16mg',
                        dosage: '1 Tab',
                        frequency: 'Twice daily (1-0-1)',
                        duration: '10 days',
                        instructions: 'Take after meals for vertigo symptoms.'
                    }
                ],
                advice: 'Maintain regular sleep and hydration. Avoid bright strobe lights and aged cheese.',
                followUpDate: '2026-12-05'
            })
        });
        const data = await res.json();
        rxId = data.prescription?._id;
        rxNumber = data.prescription?.prescriptionNumber;

        const ok = res.status === 201 && data.success && !!rxId && !!rxNumber;
        recordTest(
            7,
            'Doctor Creates Digital Prescription with Full Structured Clinical Regimen (HTTP 201)',
            ok,
            `Prescription #: ${rxNumber}, ID: ${rxId}, Medicines: ${data.prescription?.medicines?.length}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(7, 'Prescription Creation', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 8. Auto-Completion of Appointment & Foreign Key Link
    // -------------------------------------------------------------
    try {
        const dbAppt = await Appointment.findById(apptId);
        const ok = dbAppt && dbAppt.status === 'completed' && dbAppt.prescription?.toString() === rxId;
        recordTest(
            8,
            'Workflow Automation: Appointment status automatically updated to "completed" and linked to Prescription',
            ok,
            `DB Appointment status: "${dbAppt?.status}", Linked Prescription: ${dbAppt?.prescription}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(8, 'Workflow Automation', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 9. Duplicate Prevention: Cannot Create Second Prescription for Same Appointment
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${doctorToken}` },
            body: JSON.stringify({
                appointmentId: apptId,
                diagnosis: 'Duplicate attempt',
                medicines: [{ name: 'Drug', dosage: '1', frequency: '1', duration: '1' }]
            })
        });
        const ok = res.status === 400;
        recordTest(
            9,
            'Integrity Guard: System blocks duplicate prescription issuance on the same appointment (HTTP 400)',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(9, 'Duplicate Prevention', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 10. Patient A Retrieves Prescription by ID & Appointment ID (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res1 = await fetch(`${BASE_URL}/prescriptions/${rxId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const d1 = await res1.json();

        const res2 = await fetch(`${BASE_URL}/prescriptions/appointment/${apptId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const d2 = await res2.json();

        const ok = res1.status === 200 && res2.status === 200 && d1.prescription?._id === rxId && d2.prescription?._id === rxId;
        recordTest(
            10,
            'Patient Consultation Access: Patient retrieves prescription via both direct ID and appointment ID lookups (HTTP 200)',
            ok,
            `By ID: ${d1.prescription?.prescriptionNumber}, By Appt: ${d2.prescription?.prescriptionNumber}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(10, 'Patient Consultation Access', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 11. Patient Privacy Enforcement: Patient B Strictly Forbidden from Viewing Patient A Prescription (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${rxId}`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const ok = res.status === 403;
        recordTest(
            11,
            'Patient Privacy Enforcement: Patient B blocked from accessing Patient A prescription (HTTP 403 Forbidden)',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(11, 'Patient Privacy Enforcement', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 12. Doctor and Patient Prescription History Archives (HTTP 200)
    // -------------------------------------------------------------
    try {
        const docHistRes = await fetch(`${BASE_URL}/prescriptions/my`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const docHist = await docHistRes.json();

        const patHistRes = await fetch(`${BASE_URL}/prescriptions/my`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const patHist = await patHistRes.json();

        const ok =
            docHistRes.status === 200 &&
            patHistRes.status === 200 &&
            docHist.prescriptions?.some((p) => p._id === rxId) &&
            patHist.prescriptions?.some((p) => p._id === rxId);

        recordTest(
            12,
            'Prescription History Archives: Doctor and Patient dashboards retrieve respective prescription lists (HTTP 200)',
            ok,
            `Doctor count: ${docHist.totalPrescriptions}, Patient count: ${patHist.totalPrescriptions}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(12, 'Prescription History Archives', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 13. Search Filtering on Prescriptions Archive (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/my?search=Vestibular`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const data = await res.json();
        const ok = res.status === 200 && data.prescriptions?.some((p) => p._id === rxId);
        recordTest(
            13,
            'Prescription Search Filter: Searches archive by clinical diagnosis keyword (HTTP 200)',
            ok,
            `Found ${data.prescriptions?.length} matching prescriptions`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(13, 'Prescription Search Filter', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 14. PDF Generation & Download Endpoint Verification (HTTP 200, application/pdf, valid stream)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${rxId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const contentType = res.headers.get('content-type');
        const disposition = res.headers.get('content-disposition');
        const buf = await res.arrayBuffer();
        const magic = new TextDecoder().decode(new Uint8Array(buf.slice(0, 5)));

        const ok =
            res.status === 200 &&
            contentType === 'application/pdf' &&
            disposition?.includes('attachment') &&
            magic === '%PDF-';

        recordTest(
            14,
            'PDF Download Endpoint: Streams valid application/pdf binary with Content-Disposition header',
            ok,
            `Content-Type: ${contentType}, Header: "${magic}", Size: ${buf.byteLength} bytes, File: ${disposition}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(14, 'PDF Download Endpoint', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 15. PDF Download Privacy Enforcement: Patient B Blocked from Downloading Patient A PDF (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${rxId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const ok = res.status === 403;
        recordTest(
            15,
            'PDF Download Privacy Guard: Unauthorized patient strictly forbidden from downloading PDF (HTTP 403)',
            ok,
            `Status: ${res.status}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(15, 'PDF Download Privacy Guard', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 16. Population Check: Appointment Retrieval Auto-Populates Prescription Object
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/${apptId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        const rx = data.appointment?.prescription;
        const ok = res.status === 200 && rx && rx.prescriptionNumber === rxNumber && rx.diagnosis;
        recordTest(
            16,
            'Appointment Query Population: Appointment document automatically populates full Prescription details',
            ok,
            `Populated Rx #: ${rx?.prescriptionNumber}, Diagnosis: "${rx?.diagnosis}"`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(16, 'Appointment Query Population', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // Final Summary
    // -------------------------------------------------------------
    console.log('================================================================');
    console.log(`   PHASE 8 AUDIT SUMMARY: ${passed} PASSED / ${failed} FAILED`);
    console.log('================================================================\n');

    await mongoose.disconnect();

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase8Verification().catch((err) => {
    console.error('Fatal audit error:', err);
    process.exit(1);
});
