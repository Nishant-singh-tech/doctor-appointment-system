import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Prescription from '../models/Prescription.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase8Tests() {
    console.log('=====================================================');
    console.log('   STARTING PHASE 8: DIGITAL PRESCRIPTION TEST SUITE ');
    console.log('=====================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, title, details = '') => {
        if (condition) {
            console.log(`[PASS] ${title}`);
            if (details) console.log(`       Evidence: ${details}`);
            passed++;
        } else {
            console.error(`[FAIL] ${title}`);
            if (details) console.error(`       Evidence: ${details}`);
            failed++;
        }
    };

    // -------------------------------------------------------------
    // Setup 1: Admin Login
    // -------------------------------------------------------------
    let adminToken = '';
    try {
        const adminRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        });
        const adminData = await adminRes.json();
        adminToken = adminData.token;
        assert(adminRes.status === 200 && !!adminToken, 'Setup: Admin authenticated');
    } catch (e) {
        assert(false, 'Setup: Admin login failed', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // Setup 2: Doctor 1 (Dr. Strange) Setup & Schedule
    // -------------------------------------------------------------
    let doc1Token = '', doc1Id = '';
    const doc1Email = `p8_doc1_${Date.now()}@hospital.test`;

    try {
        const doc1Reg = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Stephen Strange',
                email: doc1Email,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98765 11111',
                specialization: 'Neurology & General Practice',
                experience: 15,
                fees: 2000
            })
        })).json();
        doc1Token = doc1Reg.token;
        doc1Id = doc1Reg.user._id;

        // Admin approves doc1
        await fetch(`${BASE_URL}/admin/doctors/${doc1Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Set doctor availability
        await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '09:00', end: '17:00' },
                slotDuration: 30,
                breakTime: { start: '13:00', end: '14:00' },
                timeZone: 'Asia/Kolkata'
            })
        });

        assert(!!doc1Id, 'Setup: Doctor 1 (Dr. Strange) created, approved, and schedule configured');
    } catch (e) {
        assert(false, 'Setup: Doctor 1 setup failed', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // Setup 3: Doctor 2 (Dr. Bruce Banner) for Ownership Testing
    // -------------------------------------------------------------
    let doc2Token = '', doc2Id = '';
    const doc2Email = `p8_doc2_${Date.now()}@hospital.test`;

    try {
        const doc2Reg = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Bruce Banner',
                email: doc2Email,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98765 22222',
                specialization: 'Biochemistry & Internal Medicine',
                experience: 10,
                fees: 1500
            })
        })).json();
        doc2Token = doc2Reg.token;
        doc2Id = doc2Reg.user._id;

        await fetch(`${BASE_URL}/admin/doctors/${doc2Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        assert(!!doc2Id, 'Setup: Doctor 2 (Dr. Banner) created and approved');
    } catch (e) {
        assert(false, 'Setup: Doctor 2 setup failed', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // Setup 4: Patients A and B
    // -------------------------------------------------------------
    let patientAToken = '', patientAId = '';
    let patientBToken = '', patientBId = '';

    try {
        const paRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Peter Parker',
                email: `p8_patientA_${Date.now()}@test.com`,
                password: 'PatientPassword123',
                role: 'patient',
                phone: '+91 91234 11111'
            })
        })).json();
        patientAToken = paRes.token;
        patientAId = paRes.user._id;

        const pbRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Miles Morales',
                email: `p8_patientB_${Date.now()}@test.com`,
                password: 'PatientPassword123',
                role: 'patient',
                phone: '+91 91234 22222'
            })
        })).json();
        patientBToken = pbRes.token;
        patientBId = pbRes.user._id;

        assert(!!patientAId && !!patientBId, 'Setup: Patient A (Peter) and Patient B (Miles) created');
    } catch (e) {
        assert(false, 'Setup: Patients creation failed', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // Setup 5: Book Appointment for Patient A with Doctor 1
    // -------------------------------------------------------------
    let apptAId = '';
    const getUpcomingWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getUpcomingWeekday(3);
    const testSlot = '10:00 - 10:30';

    try {
        const bookRes = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId: doc1Id,
                date: testDate,
                timeSlot: testSlot,
                reason: 'Persistent migraine and sensory overload'
            })
        });
        const bookData = await bookRes.json();
        apptAId = bookData.appointment?._id;
        assert(bookRes.status === 201 && !!apptAId, 'Setup: Booked appointment for Patient A with Doctor 1', `Appt ID: ${apptAId}`);
    } catch (e) {
        assert(false, 'Setup: Booking appointment failed', e.message);
        process.exit(1);
    }

    console.log('\n--- EXECUTING PHASE 8 PRESCRIPTION TESTS ---\n');

    // -------------------------------------------------------------
    // Test 1: Input Validation - Missing Diagnosis (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: '', // missing
                medicines: [
                    { name: 'Sumatriptan 50mg', dosage: '1 Tab', frequency: 'PRN', duration: '5 days' }
                ]
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.message.toLowerCase().includes('diagnosis'),
            'Test 1: Backend rejects prescription with missing diagnosis (HTTP 400)',
            data.message
        );
    } catch (e) {
        assert(false, 'Test 1: Input validation test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 2: Input Validation - Empty Medicines Array (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Acute Migraine Cephalea',
                medicines: [] // empty
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.message.toLowerCase().includes('medicine'),
            'Test 2: Backend rejects prescription with empty medicines list (HTTP 400)',
            data.message
        );
    } catch (e) {
        assert(false, 'Test 2: Empty medicines validation failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 3: Input Validation - Incomplete Medicine Item (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Acute Migraine Cephalea',
                medicines: [
                    { name: 'Sumatriptan 50mg', dosage: '', frequency: 'PRN', duration: '5 days' } // missing dosage
                ]
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.message.toLowerCase().includes('dosage'),
            'Test 3: Backend rejects medicine item missing required dosage (HTTP 400)',
            data.message
        );
    } catch (e) {
        assert(false, 'Test 3: Incomplete medicine item test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 4: Role Authorization - Patient Cannot Create Prescription (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Self Diagnosis',
                medicines: [{ name: 'Aspirin', dosage: '1 Tab', frequency: '1-0-1', duration: '3 days' }]
            })
        });
        assert(
            res.status === 403,
            'Test 4: Patient strictly forbidden from issuing digital prescriptions (HTTP 403)',
            `Status: ${res.status}`
        );
    } catch (e) {
        assert(false, 'Test 4: Role authorization test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 5: Doctor Ownership - Doctor 2 Cannot Prescribe for Doctor 1's Appointment (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc2Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Tension Headache',
                medicines: [{ name: 'Ibuprofen 400mg', dosage: '1 Tab', frequency: '1-0-1', duration: '3 days' }]
            })
        });
        const data = await res.json();
        assert(
            res.status === 403 && (data.message.toLowerCase().includes('authorized') || data.message.toLowerCase().includes('access denied') || data.message.toLowerCase().includes('assigned')),
            'Test 5: Doctor ownership strictly enforced — Doctor 2 blocked from Doctor 1 appointment (HTTP 403)',
            data.message
        );
    } catch (e) {
        assert(false, 'Test 5: Doctor ownership test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 6: Doctor 1 Creates Valid Digital Prescription (HTTP 201)
    // -------------------------------------------------------------
    let createdPrescriptionId = '';
    let createdPrescriptionNumber = '';

    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Vestibular Migraine with Photophobia',
                symptoms: 'Unilateral throbbing head pain, aura, visual sensitivity',
                medicines: [
                    {
                        name: 'Sumatriptan Succinate 50mg',
                        dosage: '1 Tablet',
                        frequency: 'At onset of migraine',
                        duration: '5 days PRN',
                        instructions: 'Take immediately with water at onset. Max 2 tabs in 24 hours.'
                    },
                    {
                        name: 'Naproxen Sodium 500mg',
                        dosage: '1 Tablet',
                        frequency: 'Twice daily (1-0-1)',
                        duration: '3 days',
                        instructions: 'Take strictly after meals with plenty of water.'
                    },
                    {
                        name: 'Pantoprazole 40mg',
                        dosage: '1 Tablet',
                        frequency: 'Once daily before breakfast (1-0-0)',
                        duration: '5 days',
                        instructions: 'Take 30 minutes before food for gastro-protection.'
                    }
                ],
                advice: 'Dark room rest during acute episodes. Stay hydrated. Limit caffeine and maintain sleep diary.',
                followUpDate: '2026-11-27'
            })
        });
        const data = await res.json();
        createdPrescriptionId = data.prescription?._id;
        createdPrescriptionNumber = data.prescription?.prescriptionNumber;

        assert(
            res.status === 201 && data.success && !!createdPrescriptionId && !!createdPrescriptionNumber,
            'Test 6: Doctor 1 successfully creates digital prescription (HTTP 201)',
            `Prescription #: ${createdPrescriptionNumber}, ID: ${createdPrescriptionId}`
        );
    } catch (e) {
        assert(false, 'Test 6: Digital prescription creation failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 7: Verify Appointment Status Auto-Transitioned to 'completed'
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/${apptAId}`, {
            headers: { 'Authorization': `Bearer ${doc1Token}` }
        });
        const data = await res.json();
        const appt = data.appointment;
        assert(
            res.status === 200 && appt?.status === 'completed' && appt?.prescription?._id === createdPrescriptionId,
            'Test 7: Appointment auto-transitions to "completed" status & links prescription ObjectId',
            `Status: ${appt?.status}, Linked Rx: ${appt?.prescription?._id}`
        );
    } catch (e) {
        assert(false, 'Test 7: Appointment status verification failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 8: Duplicate Prescription Prevention (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                diagnosis: 'Duplicate attempt',
                medicines: [{ name: 'Test Med', dosage: '1', frequency: '1-0-1', duration: '1 day' }]
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.message.toLowerCase().includes('already'),
            'Test 8: System prevents duplicate prescriptions for the same consultation (HTTP 400)',
            data.message
        );
    } catch (e) {
        assert(false, 'Test 8: Duplicate prescription test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 9: Patient A Retrieves Their Prescription by ID (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success &&
            data.prescription?._id === createdPrescriptionId &&
            data.prescription?.medicines?.length === 3,
            'Test 9: Patient A retrieves their prescription with all 3 structured medicines (HTTP 200)',
            `Diagnosis: ${data.prescription?.diagnosis}, Meds count: ${data.prescription?.medicines?.length}`
        );
    } catch (e) {
        assert(false, 'Test 9: Patient A prescription retrieval failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 10: Retrieve Prescription by Appointment ID (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/appointment/${apptAId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        assert(
            res.status === 200 && data.success && data.prescription?._id === createdPrescriptionId,
            'Test 10: Retrieve prescription via appointment ID lookup (HTTP 200)',
            `Found Rx: ${data.prescription?.prescriptionNumber}`
        );
    } catch (e) {
        assert(false, 'Test 10: Lookup by appointment ID failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 11: Patient Privacy Violation Test - Patient B Blocked (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const data = await res.json();
        assert(
            res.status === 403,
            'Test 11: Patient Privacy Check — Patient B strictly forbidden from viewing Patient A prescription (HTTP 403)',
            `Status: ${res.status}, Message: ${data.message}`
        );
    } catch (e) {
        assert(false, 'Test 11: Patient privacy test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 12: Doctor 1 Views Issued Prescriptions History (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/my`, {
            headers: { 'Authorization': `Bearer ${doc1Token}` }
        });
        const data = await res.json();
        const found = data.prescriptions?.some((p) => p._id === createdPrescriptionId);
        assert(
            res.status === 200 && data.success && found && data.totalPrescriptions >= 1,
            'Test 12: Doctor 1 retrieves issued prescription history (HTTP 200)',
            `Total issued prescriptions: ${data.totalPrescriptions}`
        );
    } catch (e) {
        assert(false, 'Test 12: Doctor prescription history test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 13: Prescription Search & Filter by Diagnosis Keyword (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/my?search=Migraine`, {
            headers: { 'Authorization': `Bearer ${doc1Token}` }
        });
        const data = await res.json();
        const found = data.prescriptions?.some((p) => p._id === createdPrescriptionId);
        assert(
            res.status === 200 && data.success && found,
            'Test 13: Doctor searches prescriptions by clinical diagnosis keyword "Migraine" (HTTP 200)',
            `Matches found: ${data.prescriptions?.length}`
        );
    } catch (e) {
        assert(false, 'Test 13: Search filter test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 14: Patient A Views Their Prescriptions History (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/my`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        const found = data.prescriptions?.some((p) => p._id === createdPrescriptionId);
        assert(
            res.status === 200 && data.success && found,
            'Test 14: Patient A retrieves their received prescriptions archive (HTTP 200)',
            `Total patient prescriptions: ${data.totalPrescriptions}`
        );
    } catch (e) {
        assert(false, 'Test 14: Patient prescription history failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 15: Patient A Downloads Official PDF Stream (HTTP 200, application/pdf)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const contentType = res.headers.get('content-type');
        const contentDisposition = res.headers.get('content-disposition');
        const buffer = await res.arrayBuffer();
        const headerMagic = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 5)));

        const isValidPdf =
            res.status === 200 &&
            contentType === 'application/pdf' &&
            contentDisposition?.includes('attachment') &&
            headerMagic === '%PDF-';

        assert(
            isValidPdf,
            'Test 15: Patient A downloads official PDF binary stream (HTTP 200, application/pdf, %PDF-)',
            `Content-Type: ${contentType}, Size: ${buffer.byteLength} bytes, Disposition: ${contentDisposition}`
        );
    } catch (e) {
        assert(false, 'Test 15: PDF download test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 16: Doctor 1 Downloads Official PDF Stream (HTTP 200)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}/pdf`, {
            headers: { 'Authorization': `Bearer ${doc1Token}` }
        });
        const buffer = await res.arrayBuffer();
        const headerMagic = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 5)));
        assert(
            res.status === 200 && headerMagic === '%PDF-',
            'Test 16: Doctor 1 downloads official PDF binary stream (HTTP 200, valid PDF header)',
            `Size: ${buffer.byteLength} bytes`
        );
    } catch (e) {
        assert(false, 'Test 16: Doctor PDF download failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 17: Patient Privacy Violation on PDF Download - Patient B Blocked (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}/pdf`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        assert(
            res.status === 403,
            'Test 17: Unauthorized patient strictly forbidden from downloading another patient\'s PDF (HTTP 403)',
            `Status: ${res.status}`
        );
    } catch (e) {
        assert(false, 'Test 17: Unauthorized PDF download test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 18: Unauthenticated Request Blocked (HTTP 401)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/prescriptions/${createdPrescriptionId}/pdf`);
        assert(
            res.status === 401,
            'Test 18: Unauthenticated request without JWT rejected (HTTP 401)',
            `Status: ${res.status}`
        );
    } catch (e) {
        assert(false, 'Test 18: Unauthenticated request test failed', e.message);
    }

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n=====================================================');
    console.log(` PHASE 8 PRESCRIPTION TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
    console.log('=====================================================\n');

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase8Tests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
