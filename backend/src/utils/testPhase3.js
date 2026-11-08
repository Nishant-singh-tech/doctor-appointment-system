import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase3Tests() {
    console.log('=====================================================');
    console.log('       STARTING PHASE 3 BACKEND API TEST SUITE       ');
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

    let patientToken = '';
    let patientId = '';
    const testPatientEmail = `p3_patient_${Date.now()}@test.com`;

    // Setup: Register a fresh test patient
    try {
        const regRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Elena Rostova',
                email: testPatientEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-4321'
            })
        });
        const regData = await regRes.json();
        patientToken = regData.token;
        patientId = regData.user._id;
        assert(regRes.status === 201 && !!patientToken, 'Setup: Created test patient for Phase 3');
    } catch (e) {
        assert(false, 'Setup: Failed to register test patient', e.message);
        process.exit(1);
    }

    // 1. View Patient Profile (GET /api/patients/profile)
    try {
        const res = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });
        const data = await res.json();
        assert(
            res.status === 200 && data.success && data.user.email === testPatientEmail,
            '1. GET /api/patients/profile returns authenticated patient profile',
            `Status: ${res.status}, Name: ${data.user.name}, Email: ${data.user.email}`
        );
    } catch (e) {
        assert(false, '1. View patient profile failed', e.message);
    }

    // 2. Update Patient Profile (PUT /api/patients/profile)
    try {
        const updateRes = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientToken}`
            },
            body: JSON.stringify({
                name: 'Elena Rostova-Petrov',
                phone: '+1 555-9988',
                address: '742 Evergreen Terrace, Springfield',
                gender: 'female',
                dateOfBirth: '1992-05-14',
                bloodGroup: 'O+'
            })
        });
        const updateData = await updateRes.json();
        assert(
            updateRes.status === 200 &&
            updateData.success &&
            updateData.user.name === 'Elena Rostova-Petrov' &&
            updateData.user.bloodGroup === 'O+' &&
            updateData.user.address === '742 Evergreen Terrace, Springfield',
            '2. PUT /api/patients/profile successfully updates patient details',
            `Status: ${updateRes.status}, BloodGroup: ${updateData.user.bloodGroup}, Address: ${updateData.user.address}`
        );
    } catch (e) {
        assert(false, '2. Update patient profile failed', e.message);
    }

    // 3. Validation on Patient Profile Update (Invalid blood group rejection)
    try {
        const res = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientToken}`
            },
            body: JSON.stringify({
                bloodGroup: 'INVALID_GROUP'
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.success === false,
            '3. Validation rejects invalid blood group on patient profile update',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '3. Invalid blood group test failed', e.message);
    }

    // 4. Access Control: Patient profile cannot be read without authentication
    try {
        const res = await fetch(`${BASE_URL}/patients/profile`);
        const data = await res.json();
        assert(
            res.status === 401 && data.success === false,
            '4. GET /api/patients/profile rejected without JWT authentication',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '4. Missing token profile test failed', e.message);
    }

    // 5. Public Doctor Directory (Only verified & active doctors appear)
    let sampleVerifiedDoctorId = '';
    try {
        const res = await fetch(`${BASE_URL}/doctors?limit=20`);
        const data = await res.json();
        const allVerified = data.doctors.every((d) => d.isVerified === true && d.isBlocked === false);
        const containsUnverified = data.doctors.some((d) => d.email === 'unverified.doctor@hospital.com');
        const containsBlocked = data.doctors.some((d) => d.email === 'blocked.doctor@hospital.com');

        if (data.doctors.length > 0) {
            sampleVerifiedDoctorId = data.doctors[0]._id;
        }

        assert(
            res.status === 200 &&
            data.success &&
            allVerified &&
            !containsUnverified &&
            !containsBlocked,
            '5. Doctor directory lists ONLY verified and active doctors (unverified & blocked excluded)',
            `Total found: ${data.totalDoctors}, all verified: ${allVerified}, unverified excluded: ${!containsUnverified}, blocked excluded: ${!containsBlocked}`
        );
    } catch (e) {
        assert(false, '5. Doctor directory test failed', e.message);
    }

    // 6. Doctor Search by Name
    try {
        const res = await fetch(`${BASE_URL}/doctors?search=Jenkins`);
        const data = await res.json();
        const correct =
            res.status === 200 &&
            data.doctors.length === 1 &&
            data.doctors[0].name.includes('Sarah Jenkins');
        assert(
            correct,
            '6. Doctor search by name successfully finds matching doctor',
            `Found: ${data.doctors.map((d) => d.name).join(', ')}`
        );
    } catch (e) {
        assert(false, '6. Doctor search test failed', e.message);
    }

    // 7. Filter Doctors by Specialization
    try {
        const res = await fetch(`${BASE_URL}/doctors?specialization=Dermatology`);
        const data = await res.json();
        const allDermatologists =
            res.status === 200 &&
            data.doctors.length > 0 &&
            data.doctors.every((d) => d.specialization.toLowerCase() === 'dermatology');
        assert(
            allDermatologists,
            '7. Filter by specialization returns only matching specialist doctors',
            `Count: ${data.doctors.length}, Doctors: ${data.doctors.map((d) => d.name).join(', ')}`
        );
    } catch (e) {
        assert(false, '7. Specialization filter test failed', e.message);
    }

    // 8. Filter Doctors by Location
    try {
        const res = await fetch(`${BASE_URL}/doctors?location=Mumbai`);
        const data = await res.json();
        const allMumbai =
            res.status === 200 &&
            data.doctors.length > 0 &&
            data.doctors.every((d) => d.location.includes('Mumbai'));
        assert(
            allMumbai,
            '8. Filter by location returns only doctors in target location',
            `Count: ${data.doctors.length}, Doctor: ${data.doctors[0].name} (${data.doctors[0].location})`
        );
    } catch (e) {
        assert(false, '8. Location filter test failed', e.message);
    }

    // 9. Pagination for Doctor Directory
    try {
        const pageSize = 3;
        const page1Res = await fetch(`${BASE_URL}/doctors?page=1&limit=${pageSize}`);
        const page1Data = await page1Res.json();

        const page2Res = await fetch(`${BASE_URL}/doctors?page=2&limit=${pageSize}`);
        const page2Data = await page2Res.json();

        const paginationWorks =
            page1Res.status === 200 &&
            page2Res.status === 200 &&
            page1Data.doctors.length === pageSize &&
            page2Data.doctors.length === pageSize &&
            page1Data.doctors[0]._id !== page2Data.doctors[0]._id &&
            page1Data.pages > 1;

        assert(
            paginationWorks,
            '9. Doctor directory pagination returns distinct sets across pages',
            `Page 1 items: ${page1Data.doctors.length}, Page 2 items: ${page2Data.doctors.length}, Total pages: ${page1Data.pages}`
        );
    } catch (e) {
        assert(false, '9. Pagination test failed', e.message);
    }

    // 10. Doctor Profile Details (GET /api/doctors/:id)
    try {
        const res = await fetch(`${BASE_URL}/doctors/${sampleVerifiedDoctorId}`);
        const data = await res.json();
        const hasDetails =
            res.status === 200 &&
            data.success &&
            data.doctor.qualifications &&
            data.doctor.experience > 0 &&
            data.doctor.fees > 0 &&
            data.doctor.location &&
            data.doctor.about;

        assert(
            hasDetails,
            '10. GET /api/doctors/:id returns full doctor details (qualifications, exp, fees, location, about)',
            `Doctor: ${data.doctor.name}, Qual: ${data.doctor.qualifications}, Exp: ${data.doctor.experience} yrs, Fee: ₹${data.doctor.fees}, Location: ${data.doctor.location}`
        );
    } catch (e) {
        assert(false, '10. Doctor profile details test failed', e.message);
    }

    // 11. Security Check: Unverified Doctor Profile details are not publicly accessible
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const unverifiedDoc = await User.findOne({ email: 'unverified.doctor@hospital.com' });
        await mongoose.disconnect();

        if (unverifiedDoc) {
            const res = await fetch(`${BASE_URL}/doctors/${unverifiedDoc._id}`);
            assert(
                res.status === 404,
                '11. Unverified doctor profile details are protected and return HTTP 404 to public',
                `HTTP ${res.status}`
            );
        } else {
            assert(false, '11. Could not find unverified doctor to test');
        }
    } catch (e) {
        assert(false, '11. Unverified doctor security test failed', e.message);
    }

    console.log('\n=====================================================');
    console.log(`TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('=====================================================');
    process.exit(failed > 0 ? 1 : 0);
}

runPhase3Tests();
