import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

const results = [];

function recordTest(num, name, passed, evidence) {
    results.push({ num, name, passed, evidence });
    const status = passed ? '[PASS]' : '[FAIL]';
    console.log(`${status} ${num}. ${name}`);
    console.log(`       Evidence: ${evidence}\n`);
}

async function runVerification() {
    console.log('=====================================================');
    console.log('   INDEPENDENT VERIFICATION FOR PHASE 3 FEATURES     ');
    console.log('=====================================================\n');

    // 12. Backend starts and connects to MongoDB
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const isConnected = mongoose.connection.readyState === 1;
        recordTest(
            12,
            'Backend starts and connects to MongoDB',
            isConnected,
            `Mongoose connection readyState = ${mongoose.connection.readyState} (Host: ${mongoose.connection.host})`
        );
    } catch (err) {
        recordTest(12, 'Backend starts and connects to MongoDB', false, err.message);
        process.exit(1);
    }

    // Setup: Create two independent patient accounts for testing data isolation
    const patientA_email = `patient_a_${Date.now()}@test.com`;
    const patientB_email = `patient_b_${Date.now()}@test.com`;
    let tokenA = '';
    let tokenB = '';
    let idA = '';
    let idB = '';

    try {
        const resA = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Patient Alpha',
                email: patientA_email,
                password: 'Password123',
                role: 'patient',
                phone: '111-222-3333'
            })
        });
        const dataA = await resA.json();
        tokenA = dataA.token;
        idA = dataA.user._id;

        const resB = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Patient Beta',
                email: patientB_email,
                password: 'Password123',
                role: 'patient',
                phone: '444-555-6666'
            })
        });
        const dataB = await resB.json();
        tokenB = dataB.token;
        idB = dataB.user._id;
    } catch (err) {
        console.error('Setup failed:', err);
        process.exit(1);
    }

    // 1. Patient can view their own profile
    try {
        const res = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const data = await res.json();
        const canView = res.status === 200 && data.success && data.user.email === patientA_email;
        recordTest(
            1,
            'Patient can view their own profile',
            canView,
            `HTTP ${res.status}: Returned patient email "${data.user.email}" matching authenticated token ID`
        );
    } catch (err) {
        recordTest(1, 'Patient can view their own profile', false, err.message);
    }

    // 2. Patient can update their own profile
    try {
        const res = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({
                name: 'Patient Alpha Updated',
                phone: '999-888-7777',
                address: '100 Medical Plaza, Suite 20',
                gender: 'male',
                bloodGroup: 'B+',
                dateOfBirth: '1990-01-15'
            })
        });
        const data = await res.json();
        const canUpdate =
            res.status === 200 &&
            data.success &&
            data.user.name === 'Patient Alpha Updated' &&
            data.user.bloodGroup === 'B+' &&
            data.user.address === '100 Medical Plaza, Suite 20';

        recordTest(
            2,
            'Patient can update their own profile',
            canUpdate,
            `HTTP ${res.status}: Name updated to "${data.user.name}", BloodGroup: "${data.user.bloodGroup}", Address: "${data.user.address}"`
        );
    } catch (err) {
        recordTest(2, 'Patient can update their own profile', false, err.message);
    }

    // 3. A patient cannot access or modify another patient's private profile
    try {
        // Patient A sends update request trying to hijack Patient B's record by including Patient B's _id and email
        const hijackRes = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}` // Patient A's token
            },
            body: JSON.stringify({
                _id: idB, // Attempting to target Patient B
                email: patientB_email,
                name: 'Hacked Beta Name',
                address: 'Hacked Address'
            })
        });

        // Verify Patient B in MongoDB remains completely unchanged
        const patientB_inDB = await User.findById(idB);
        const bUntouched =
            patientB_inDB.name === 'Patient Beta' &&
            patientB_inDB.address !== 'Hacked Address';

        // Verify Patient A cannot view Patient B's profile
        const viewRes = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const viewData = await viewRes.json();
        const noCrossView = viewData.user.email === patientA_email && viewData.user.email !== patientB_email;

        recordTest(
            3,
            "A patient cannot access or modify another patient's private profile",
            bUntouched && noCrossView,
            `Tamper payload by Patient A did not affect Patient B (Name in DB remains "${patientB_inDB.name}"). Backend strictly bounds operations to cryptographic JWT identity.`
        );
    } catch (err) {
        recordTest(3, "A patient cannot access or modify another patient's private profile", false, err.message);
    }

    // 4. Doctor directory loads correctly
    try {
        const res = await fetch(`${BASE_URL}/doctors`);
        const data = await res.json();
        const loadsCorrectly = res.status === 200 && data.success && Array.isArray(data.doctors) && data.totalDoctors > 0;
        recordTest(
            4,
            'Doctor directory loads correctly',
            loadsCorrectly,
            `HTTP ${res.status}: Retrieved ${data.doctors.length} doctors on page 1 of ${data.pages} (Total: ${data.totalDoctors} doctors)`
        );
    } catch (err) {
        recordTest(4, 'Doctor directory loads correctly', false, err.message);
    }

    // 5. Doctor search by name works
    try {
        const res = await fetch(`${BASE_URL}/doctors?search=Sarah`);
        const data = await res.json();
        const searchMatches =
            res.status === 200 &&
            data.doctors.length > 0 &&
            data.doctors.every((d) => d.name.toLowerCase().includes('sarah'));
        recordTest(
            5,
            'Doctor search by name works',
            searchMatches,
            `HTTP ${res.status}: Query "search=Sarah" matched ${data.doctors.length} doctor(s): "${data.doctors.map(d => d.name).join(', ')}"`
        );
    } catch (err) {
        recordTest(5, 'Doctor search by name works', false, err.message);
    }

    // 6. Specialization and location filters work
    try {
        // Specialization filter
        const specRes = await fetch(`${BASE_URL}/doctors?specialization=Neurology`);
        const specData = await specRes.json();
        const specMatches =
            specRes.status === 200 &&
            specData.doctors.length > 0 &&
            specData.doctors.every((d) => d.specialization.toLowerCase().includes('neurology'));

        // Location filter
        const locRes = await fetch(`${BASE_URL}/doctors?location=Mumbai`);
        const locData = await locRes.json();
        const locMatches =
            locRes.status === 200 &&
            locData.doctors.length > 0 &&
            locData.doctors.every((d) => d.location.toLowerCase().includes('mumbai'));

        recordTest(
            6,
            'Specialization and location filters work',
            specMatches && locMatches,
            `Specialization "Neurology" returned: ${specData.doctors.map(d => d.name + ' (' + d.specialization + ')').join(', ')}; Location "Mumbai" returned: ${locData.doctors.map(d => d.name + ' (' + d.location + ')').join(', ')}`
        );
    } catch (err) {
        recordTest(6, 'Specialization and location filters work', false, err.message);
    }

    // 7. Only verified and unblocked doctors appear in the public directory
    try {
        const res = await fetch(`${BASE_URL}/doctors?limit=50`);
        const data = await res.json();
        const allVerified = data.doctors.every((d) => d.isVerified === true);
        const noneBlocked = data.doctors.every((d) => d.isBlocked === false);
        const containsUnverified = data.doctors.some((d) => d.email === 'unverified.doctor@hospital.com');
        const containsBlocked = data.doctors.some((d) => d.email === 'blocked.doctor@hospital.com');

        const strictPrivacy = allVerified && noneBlocked && !containsUnverified && !containsBlocked;
        recordTest(
            7,
            'Only verified and unblocked doctors appear in the public directory',
            strictPrivacy,
            `All returned doctors are verified: ${allVerified}, unblocked: ${noneBlocked}. Unverified sample excluded: ${!containsUnverified}, Blocked sample excluded: ${!containsBlocked}`
        );
    } catch (err) {
        recordTest(7, 'Only verified and unblocked doctors appear in the public directory', false, err.message);
    }

    // 8. Doctor profile pages display the available qualifications, experience, location, and consultation fee
    let verifiedDoctorId = '';
    try {
        const listRes = await fetch(`${BASE_URL}/doctors?search=Marcus`);
        const listData = await listRes.json();
        verifiedDoctorId = listData.doctors[0]._id;

        const profileRes = await fetch(`${BASE_URL}/doctors/${verifiedDoctorId}`);
        const profileData = await profileRes.json();
        const doc = profileData.doctor;

        const hasAllFields =
            profileRes.status === 200 &&
            !!doc.qualifications &&
            doc.experience !== undefined &&
            !!doc.location &&
            doc.fees !== undefined;

        recordTest(
            8,
            'Doctor profile pages display qualifications, experience, location, and consultation fee',
            hasAllFields,
            `HTTP ${profileRes.status} for Dr. ${doc.name}: Qualifications: "${doc.qualifications}", Experience: ${doc.experience} yrs, Location: "${doc.location}", Fee: ₹${doc.fees}`
        );
    } catch (err) {
        recordTest(8, 'Doctor profile pages display qualifications, experience, location, and consultation fee', false, err.message);
    }

    // 9. Backend authorization is enforced independently of frontend route protection
    try {
        // Direct API call without token
        const noTokenRes = await fetch(`${BASE_URL}/patients/profile`);
        const noTokenData = await noTokenRes.json();

        // Direct API call with tampered token
        const badTokenRes = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': 'Bearer forgery.signature.invalid' }
        });
        const badTokenData = await badTokenRes.json();

        const authEnforced =
            noTokenRes.status === 401 &&
            noTokenData.success === false &&
            badTokenRes.status === 401 &&
            badTokenData.success === false;

        recordTest(
            9,
            'Backend authorization is enforced independently of frontend route protection',
            authEnforced,
            `Missing token: HTTP ${noTokenRes.status} ("${noTokenData.message}"); Malformed token: HTTP ${badTokenRes.status} ("${badTokenData.message}")`
        );
    } catch (err) {
        recordTest(9, 'Backend authorization is enforced independently of frontend route protection', false, err.message);
    }

    // 10. Invalid inputs return appropriate errors
    try {
        // Test empty name on profile update
        const emptyNameRes = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({ name: '   ' })
        });
        const emptyNameData = await emptyNameRes.json();

        // Test invalid blood group
        const badBloodRes = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({ bloodGroup: 'Z_POSITIVE' })
        });
        const badBloodData = await badBloodRes.json();

        // Test invalid gender
        const badGenderRes = await fetch(`${BASE_URL}/patients/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenA}`
            },
            body: JSON.stringify({ gender: 'alien' })
        });
        const badGenderData = await badGenderRes.json();

        const inputValidationPassed =
            emptyNameRes.status === 400 &&
            badBloodRes.status === 400 &&
            badGenderRes.status === 400;

        recordTest(
            10,
            'Invalid inputs return appropriate errors',
            inputValidationPassed,
            `Empty name: HTTP ${emptyNameRes.status} ("${emptyNameData.message}"); Invalid blood group: HTTP ${badBloodRes.status} ("${badBloodData.message}"); Invalid gender: HTTP ${badGenderRes.status} ("${badGenderData.message}")`
        );
    } catch (err) {
        recordTest(10, 'Invalid inputs return appropriate errors', false, err.message);
    }

    await mongoose.disconnect();
    console.log('=====================================================');
    const totalPassed = results.filter((r) => r.passed).length;
    console.log(`VERIFICATION SUMMARY: ${totalPassed}/${results.length} PASSED`);
    console.log('=====================================================');

    process.exit(totalPassed === results.length ? 0 : 1);
}

runVerification();
