const BASE_URL = 'http://localhost:5000/api/auth';

async function runTests() {
    console.log('--- STARTING BACKEND AUTH TESTS ---');
    let passed = 0;
    let failed = 0;

    const assert = (condition, title) => {
        if (condition) {
            console.log(`[PASS] ${title}`);
            passed++;
        } else {
            console.error(`[FAIL] ${title}`);
            failed++;
        }
    };

    // 1. Test Admin Self-Registration Prevention
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Hacker Admin',
                email: 'hacker@admin.com',
                password: 'password123',
                role: 'admin'
            })
        });
        const data = await res.json();
        assert(res.status === 400 && data.success === false, '1. Admin registration blocked via public endpoint');
    } catch (e) {
        assert(false, `1. Admin registration test error: ${e.message}`);
    }

    // 2. Test Patient Registration
    const testPatientEmail = `patient_${Date.now()}@example.com`;
    let patientToken = '';
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Alice Patient',
                email: testPatientEmail,
                password: 'password123',
                role: 'patient',
                phone: '1234567890'
            })
        });
        const data = await res.json();
        patientToken = data.token;
        assert(
            res.status === 201 &&
            data.success === true &&
            data.user.role === 'patient' &&
            data.user.password === undefined && // Never exposes password
            !!data.token,
            '2. Patient registration successful with JWT & without password exposure'
        );
    } catch (e) {
        assert(false, `2. Patient registration error: ${e.message}`);
    }

    // 3. Test Duplicate Email Registration
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Alice Duplicate',
                email: testPatientEmail,
                password: 'password123',
                role: 'patient'
            })
        });
        const data = await res.json();
        assert(res.status === 400 && data.success === false, '3. Duplicate email registration rejected');
    } catch (e) {
        assert(false, `3. Duplicate email registration error: ${e.message}`);
    }

    // 4. Test Doctor Registration
    const testDoctorEmail = `doctor_${Date.now()}@example.com`;
    let doctorToken = '';
    try {
        const res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. John Smith',
                email: testDoctorEmail,
                password: 'doctorPassword123',
                role: 'doctor',
                phone: '9876543210',
                specialization: 'Cardiology',
                experience: 12,
                fees: 500
            })
        });
        const data = await res.json();
        doctorToken = data.token;
        assert(
            res.status === 201 &&
            data.success === true &&
            data.user.role === 'doctor' &&
            data.user.specialization === 'Cardiology' &&
            data.user.isVerified === false && // Doctors start unverified
            !!data.token,
            '4. Doctor registration successful with specialization & isVerified:false'
        );
    } catch (e) {
        assert(false, `4. Doctor registration error: ${e.message}`);
    }

    // 5. Test Patient Login
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testPatientEmail,
                password: 'password123'
            })
        });
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success === true &&
            data.user.role === 'patient' &&
            !!data.token,
            '5. Patient login successful with token'
        );
    } catch (e) {
        assert(false, `5. Patient login error: ${e.message}`);
    }

    // 6. Test Seeded Admin Login
    let adminToken = '';
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: 'Admin@123456'
            })
        });
        const data = await res.json();
        adminToken = data.token;
        assert(
            res.status === 200 &&
            data.success === true &&
            data.user.role === 'admin' &&
            !!data.token,
            '6. Admin login successful with token and role: admin'
        );
    } catch (e) {
        assert(false, `6. Admin login error: ${e.message}`);
    }

    // 7. Test Invalid Password Login
    try {
        const res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testPatientEmail,
                password: 'wrongPassword!'
            })
        });
        const data = await res.json();
        assert(res.status === 401 && data.success === false, '7. Login with wrong password rejected');
    } catch (e) {
        assert(false, `7. Invalid password test error: ${e.message}`);
    }

    // 8. Test Protected Profile with Valid Token
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientToken}`
            }
        });
        const data = await res.json();
        assert(
            res.status === 200 &&
            data.success === true &&
            data.user.email === testPatientEmail,
            '8. GET /api/auth/profile returns correct user with valid Bearer token'
        );
    } catch (e) {
        assert(false, `8. Profile test error: ${e.message}`);
    }

    // 9. Test Protected Profile without Token
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            method: 'GET'
        });
        const data = await res.json();
        assert(res.status === 401 && data.success === false, '9. GET /api/auth/profile rejected when no token provided');
    } catch (e) {
        assert(false, `9. Missing token test error: ${e.message}`);
    }

    // 10. Test Protected Profile with Invalid Token
    try {
        const res = await fetch(`${BASE_URL}/profile`, {
            headers: {
                'Authorization': 'Bearer invalid.token.value'
            }
        });
        const data = await res.json();
        assert(res.status === 401 && data.success === false, '10. GET /api/auth/profile rejected with fake/tampered token');
    } catch (e) {
        assert(false, `10. Invalid token test error: ${e.message}`);
    }

    // 11. Test Blocked User Cannot Access Protected Routes and Cannot Login
    try {
        const mongoose = (await import('mongoose')).default;
        const User = (await import('../models/User.js')).default;
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        
        // Block the test patient in MongoDB
        await User.updateOne({ email: testPatientEmail }, { isBlocked: true });
        await mongoose.disconnect();

        // Check if existing token can access profile
        const profileRes = await fetch(`${BASE_URL}/profile`, {
            headers: {
                'Authorization': `Bearer ${patientToken}`
            }
        });
        const profileData = await profileRes.json();
        assert(
            profileRes.status === 403 &&
            profileData.success === false &&
            profileData.message.includes('blocked'),
            '11. Blocked account rejected from accessing protected API with 403'
        );

        // Check if blocked user can log in
        const loginRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testPatientEmail,
                password: 'password123'
            })
        });
        const loginData = await loginRes.json();
        assert(
            loginRes.status === 403 &&
            loginData.success === false &&
            loginData.message.includes('blocked'),
            '12. Blocked account rejected from logging in with 403'
        );
    } catch (e) {
        assert(false, `11/12. Blocked user test error: ${e.message}`);
    }

    console.log(`\nTests finished: ${passed} passed, ${failed} failed.`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
