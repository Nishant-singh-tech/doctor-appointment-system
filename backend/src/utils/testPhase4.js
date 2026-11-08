import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase4Tests() {
    console.log('=====================================================');
    console.log('       STARTING PHASE 4 BACKEND API TEST SUITE       ');
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

    // Setup: Login Admin
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
        assert(adminRes.status === 200 && !!adminToken, 'Setup: Admin authenticated for verification tests');
    } catch (e) {
        assert(false, 'Setup: Admin login failed', e.message);
        process.exit(1);
    }

    // Setup: Register Doctor A and Doctor B
    let docAToken = '';
    let docAId = '';
    const docAEmail = `doc_a_${Date.now()}@test.com`;

    let docBToken = '';
    let docBId = '';
    const docBEmail = `doc_b_${Date.now()}@test.com`;

    try {
        const resA = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Gregory House',
                email: docAEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+1 555-1001',
                specialization: 'Diagnostics'
            })
        });
        const dataA = await resA.json();
        docAToken = dataA.token;
        docAId = dataA.user._id;

        const resB = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. James Wilson',
                email: docBEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+1 555-1002',
                specialization: 'Oncology'
            })
        });
        const dataB = await resB.json();
        docBToken = dataB.token;
        docBId = dataB.user._id;

        assert(resA.status === 201 && resB.status === 201, 'Setup: Registered Doctor A & Doctor B');
    } catch (e) {
        assert(false, 'Setup: Doctor registration failed', e.message);
        process.exit(1);
    }

    // 1. Doctor can view their own profile (GET /api/doctors/profile/me)
    try {
        const res = await fetch(`${BASE_URL}/doctors/profile/me`, {
            headers: { 'Authorization': `Bearer ${docAToken}` }
        });
        const data = await res.json();
        assert(
            res.status === 200 && data.success && data.doctor.email === docAEmail,
            '1. Doctor can view their own profile via GET /api/doctors/profile/me',
            `Name: ${data.doctor.name}, Specialization: ${data.doctor.specialization}`
        );
    } catch (e) {
        assert(false, '1. Doctor view profile test failed', e.message);
    }

    // 2. Doctor can update their own professional profile (PUT /api/doctors/profile/me)
    try {
        const res = await fetch(`${BASE_URL}/doctors/profile/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                name: 'Dr. Gregory House, M.D.',
                specialization: 'Infectious Disease & Nephrology',
                qualifications: 'MD - Johns Hopkins School of Medicine',
                experience: 20,
                fees: 1200,
                location: 'Princeton, NJ',
                hospital: 'Princeton-Plainsboro Teaching Hospital',
                about: 'Head of Diagnostic Medicine specializing in complex multi-system pathologies.'
            })
        });
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success &&
            data.doctor.name === 'Dr. Gregory House, M.D.' &&
            data.doctor.fees === 1200 &&
            data.doctor.experience === 20 &&
            data.doctor.location === 'Princeton, NJ',
            '2. Doctor can update professional profile (qualifications, fees, experience, location, about)',
            `Status: ${res.status}, Fees: ₹${data.doctor.fees}, Exp: ${data.doctor.experience} yrs`
        );
    } catch (e) {
        assert(false, '2. Doctor update profile test failed', e.message);
    }

    // 3. Doctor cannot modify another doctor's profile
    try {
        // Doctor A tries to send an update targeting Doctor B by including Doctor B's _id
        await fetch(`${BASE_URL}/doctors/profile/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                _id: docBId,
                fees: 1500 // Attempts to change Doctor B's fee to 1500
            })
        });

        // Verify Doctor B in database is untouched
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const docBInDB = await User.findById(docBId);
        await mongoose.disconnect();

        assert(
            docBInDB.name === 'Dr. James Wilson' && docBInDB.fees === 0,
            "3. Doctor cannot modify another doctor's profile (strictly isolated to JWT)",
            `Doctor B in DB remains fee: ₹${docBInDB.fees}, name: "${docBInDB.name}"`
        );
    } catch (e) {
        assert(false, '3. Doctor profile isolation test failed', e.message);
    }

    // 4. Doctor submits verification document (POST /api/doctors/verification/submit)
    try {
        const res = await fetch(`${BASE_URL}/doctors/verification/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                title: 'State Medical Board License #NJ-987654',
                documentUrl: 'https://secure-credentials.medicalboard.gov/license/NJ-987654.pdf',
                documentType: 'State Medical License'
            })
        });
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success &&
            data.verificationStatus === 'pending' &&
            data.documents.length > 0 &&
            data.documents[0].title.includes('State Medical Board'),
            '4. Doctor submits verification documents; verificationStatus becomes "pending"',
            `Status: ${data.verificationStatus}, Document: "${data.documents[0].title}"`
        );
    } catch (e) {
        assert(false, '4. Submit verification test failed', e.message);
    }

    // 5. Doctor cannot approve their own verification (HTTP 403 Forbidden)
    try {
        const res = await fetch(`${BASE_URL}/admin/doctors/${docAId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}` // Doctor token, not admin
            },
            body: JSON.stringify({ status: 'approved' })
        });
        assert(
            res.status === 403,
            '5. Doctor cannot approve their own verification (Admin authorization strictly enforced)',
            `HTTP ${res.status}`
        );
    } catch (e) {
        assert(false, '5. Self-approval prevention test failed', e.message);
    }

    // 6. Admin lists pending verification requests (GET /api/admin/doctors/pending)
    try {
        const res = await fetch(`${BASE_URL}/admin/doctors/pending`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const foundDocA = data.doctors.some((d) => d._id === docAId);
        assert(
            res.status === 200 && data.success && foundDocA,
            '6. Admin can retrieve pending verification requests (Doctor A present in queue)',
            `Queue count: ${data.count}`
        );
    } catch (e) {
        assert(false, '6. Admin get pending test failed', e.message);
    }

    // 7. Admin approves Doctor A verification
    try {
        const res = await fetch(`${BASE_URL}/admin/doctors/${docAId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });
        const data = await res.json();
        const approved =
            res.status === 200 &&
            data.success &&
            data.doctor.isVerified === true &&
            data.doctor.verificationStatus === 'approved';

        // Check if approved doctor now appears in public directory
        const dirRes = await fetch(`${BASE_URL}/doctors?search=Gregory`);
        const dirData = await dirRes.json();
        const inDirectory = dirData.doctors.some((d) => d._id === docAId);

        assert(
            approved && inDirectory,
            '7. Admin approves verification -> isVerified=true & Doctor now appears in public directory',
            `Status: ${data.doctor.verificationStatus}, Public directory matched: ${inDirectory}`
        );
    } catch (e) {
        assert(false, '7. Admin approval test failed', e.message);
    }

    // 8. Admin rejects Doctor B verification
    try {
        const res = await fetch(`${BASE_URL}/admin/doctors/${docBId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                status: 'rejected',
                rejectionReason: 'Board certification document expired in 2024. Please re-submit updated certificate.'
            })
        });
        const data = await res.json();
        const rejected =
            res.status === 200 &&
            data.success &&
            data.doctor.isVerified === false &&
            data.doctor.verificationStatus === 'rejected';

        // Check that rejected doctor remains EXCLUDED from public directory
        const dirRes = await fetch(`${BASE_URL}/doctors?search=Wilson`);
        const dirData = await dirRes.json();
        const notInDirectory = !dirData.doctors.some((d) => d._id === docBId);

        assert(
            rejected && notInDirectory,
            '8. Admin rejects verification -> Doctor remains unverified & excluded from directory',
            `Status: ${data.doctor.verificationStatus}, Excluded from directory: ${notInDirectory}, Reason: "${data.doctor.rejectionReason}"`
        );
    } catch (e) {
        assert(false, '8. Admin rejection test failed', e.message);
    }

    // 9. Doctor availability: Configure valid schedule (PUT /api/doctors/availability/me)
    try {
        const res = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
                workingHours: { start: '08:30', end: '16:30' },
                slotDuration: 45,
                breakTime: { start: '12:00', end: '13:00' },
                timeZone: 'America/New_York'
            })
        });
        const data = await res.json();
        const validSchedule =
            res.status === 200 &&
            data.success &&
            data.availability.slotDuration === 45 &&
            data.availability.workingHours.start === '08:30' &&
            data.availability.workingHours.end === '16:30' &&
            data.availability.workingDays.length === 4;

        assert(
            validSchedule,
            '9. Doctor configures consultation schedule (days, hours, slotDuration, breakTime)',
            `Days: ${data.availability.workingDays.join(', ')}, Hours: ${data.availability.workingHours.start}-${data.availability.workingHours.end}, Slot: ${data.availability.slotDuration} min`
        );
    } catch (e) {
        assert(false, '9. Valid schedule configuration test failed', e.message);
    }

    // 10. Schedule Validation: Reject inverted hours (start >= end)
    try {
        const res = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                workingHours: { start: '18:00', end: '09:00' } // Inverted!
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.success === false,
            '10. Schedule validation rejects inverted working hours (start >= end)',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '10. Inverted hours test failed', e.message);
    }

    // 11. Schedule Validation: Reject break time outside working hours
    try {
        const res = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docAToken}`
            },
            body: JSON.stringify({
                workingHours: { start: '09:00', end: '17:00' },
                breakTime: { start: '17:30', end: '18:30' } // Outside working hours!
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.success === false,
            '11. Schedule validation rejects break time falling outside working hours',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '11. Out-of-bounds break time test failed', e.message);
    }

    // 12. Public Doctor Availability endpoint (GET /api/doctors/:id/availability)
    try {
        const res = await fetch(`${BASE_URL}/doctors/${docAId}/availability`);
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success &&
            data.availability.slotDuration === 45 &&
            data.doctorName.includes('Gregory House'),
            '12. Public doctor availability preview accessible for verified doctor',
            `Doctor: ${data.doctorName}, Slot: ${data.availability.slotDuration} min`
        );
    } catch (e) {
        assert(false, '12. Public doctor availability test failed', e.message);
    }

    console.log('\n=====================================================');
    console.log(`TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('=====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase4Tests();
