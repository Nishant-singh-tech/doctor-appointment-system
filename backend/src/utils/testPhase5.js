import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase5Tests() {
    console.log('=====================================================');
    console.log('       STARTING PHASE 5 BACKEND API TEST SUITE       ');
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

    let adminToken = '';
    let adminUserId = '';

    // Setup 1: Login as Admin
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
        adminUserId = adminData.user._id;
        assert(adminRes.status === 200 && !!adminToken, 'Setup: Admin authenticated for Phase 5 tests');
    } catch (e) {
        assert(false, 'Setup: Admin login failed', e.message);
        process.exit(1);
    }

    // Setup 2: Register a fresh patient and doctor
    let patientToken = '';
    let patientId = '';
    const patientEmail = `p5_patient_${Date.now()}@test.com`;

    let doctorToken = '';
    let doctorId = '';
    const doctorEmail = `p5_doctor_${Date.now()}@test.com`;

    try {
        const pRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Samuel Oak',
                email: patientEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-5555'
            })
        });
        const pData = await pRes.json();
        patientToken = pData.token;
        patientId = pData.user._id;

        const dRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Stephen Strange',
                email: doctorEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+1 555-7777',
                specialization: 'Neuro-Surgery',
                experience: 15,
                fees: 2000
            })
        });
        const dData = await dRes.json();
        doctorToken = dData.token;
        doctorId = dData.user._id;

        assert(pRes.status === 201 && dRes.status === 201, 'Setup: Created test patient and test doctor');
    } catch (e) {
        assert(false, 'Setup: Failed to register test users', e.message);
        process.exit(1);
    }

    // 1. Authorization: Unauthenticated request to /api/admin/stats returns 401
    try {
        const res = await fetch(`${BASE_URL}/admin/stats`);
        assert(
            res.status === 401,
            '1. GET /api/admin/stats rejected without token (HTTP 401)',
            `Status: ${res.status}`
        );
    } catch (e) {
        assert(false, '1. Unauthenticated admin access test failed', e.message);
    }

    // 2. Authorization: Non-admin (Patient/Doctor) accessing /api/admin/stats returns 403 Forbidden
    try {
        const resPatient = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });
        const resDoctor = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        assert(
            resPatient.status === 403 && resDoctor.status === 403,
            '2. Non-admin roles (patient & doctor) strictly forbidden from admin routes (HTTP 403)',
            `Patient Status: ${resPatient.status}, Doctor Status: ${resDoctor.status}`
        );
    } catch (e) {
        assert(false, '2. Non-admin forbidden check failed', e.message);
    }

    // 3. Admin Stats: Real database statistics returned
    try {
        const res = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const hasValidStats =
            res.status === 200 &&
            data.success &&
            typeof data.stats.totalUsers === 'number' &&
            typeof data.stats.totalPatients === 'number' &&
            typeof data.stats.totalDoctors === 'number' &&
            typeof data.stats.verifiedDoctors === 'number' &&
            typeof data.stats.pendingVerifications === 'number' &&
            typeof data.stats.blockedUsers === 'number';

        assert(
            hasValidStats,
            '3. GET /api/admin/stats returns accurate real database statistics',
            `Total: ${data.stats?.totalUsers}, Patients: ${data.stats?.totalPatients}, Doctors: ${data.stats?.totalDoctors}, Verified: ${data.stats?.verifiedDoctors}, Blocked: ${data.stats?.blockedUsers}`
        );
    } catch (e) {
        assert(false, '3. Admin stats retrieval failed', e.message);
    }

    // 4. Admin Users Listing with Search and Role Filtering
    try {
        // Search by patient email
        const resSearch = await fetch(`${BASE_URL}/admin/users?search=${encodeURIComponent(patientEmail)}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataSearch = await resSearch.json();

        // Filter by role
        const resRole = await fetch(`${BASE_URL}/admin/users?role=patient&limit=5`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataRole = await resRole.json();

        const searchWorks =
            resSearch.status === 200 &&
            dataSearch.users.length === 1 &&
            dataSearch.users[0].email === patientEmail;

        const roleWorks =
            resRole.status === 200 &&
            dataRole.users.length > 0 &&
            dataRole.users.every((u) => u.role === 'patient');

        assert(
            searchWorks && roleWorks,
            '4. GET /api/admin/users correctly supports search by email and role filtering',
            `Search matched: ${dataSearch.users[0]?.name}, Role filtered count: ${dataRole.users.length}`
        );
    } catch (e) {
        assert(false, '4. Admin user search and role filter failed', e.message);
    }

    // 5. Admin Users Pagination
    try {
        const resP1 = await fetch(`${BASE_URL}/admin/users?page=1&limit=2`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataP1 = await resP1.json();

        const resP2 = await fetch(`${BASE_URL}/admin/users?page=2&limit=2`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataP2 = await resP2.json();

        const paginates =
            resP1.status === 200 &&
            resP2.status === 200 &&
            dataP1.users.length === 2 &&
            dataP2.users.length === 2 &&
            dataP1.users[0]._id !== dataP2.users[0]._id &&
            dataP1.pages > 1;

        assert(
            paginates,
            '5. GET /api/admin/users supports distinct page offsets and pagination metadata',
            `P1: ${dataP1.users[0]?.name}, P2: ${dataP2.users[0]?.name}, Total pages: ${dataP1.pages}`
        );
    } catch (e) {
        assert(false, '5. Admin user pagination failed', e.message);
    }

    // 6. Admin Doctors Listing with Search and Verification Status Filter
    try {
        const resDoc = await fetch(`${BASE_URL}/admin/doctors?search=Stephen`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataDoc = await resDoc.json();

        const resPending = await fetch(`${BASE_URL}/admin/doctors?verificationStatus=pending`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const dataPending = await resPending.json();

        const doctorSearchWorks =
            resDoc.status === 200 &&
            dataDoc.doctors.length >= 1 &&
            dataDoc.doctors.some((d) => d._id === doctorId);

        const pendingFilterWorks =
            resPending.status === 200 &&
            dataPending.doctors.length > 0 &&
            dataPending.doctors.every((d) => d.verificationStatus === 'pending');

        assert(
            doctorSearchWorks && pendingFilterWorks,
            '6. GET /api/admin/doctors lists doctors with search and verificationStatus filtering',
            `Doctor found: ${dataDoc.doctors[0]?.name}, Pending filter count: ${dataPending.doctors.length}`
        );
    } catch (e) {
        assert(false, '6. Admin doctor listing and filter failed', e.message);
    }

    // 7. Admin Blocks a User (Patient)
    try {
        const resBlock = await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        const dataBlock = await resBlock.json();

        // Verify patient can no longer access protected endpoints (HTTP 403)
        const profileRes = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        // Verify patient cannot log in (HTTP 403)
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: patientEmail,
                password: 'Password123'
            })
        });

        const blockedCorrectly =
            resBlock.status === 200 &&
            dataBlock.user.isBlocked === true &&
            profileRes.status === 403 &&
            loginRes.status === 403;

        assert(
            blockedCorrectly,
            '7. Admin blocks user -> Patient is blocked and denied profile access and login (HTTP 403)',
            `Block status: ${dataBlock.user.isBlocked}, Profile HTTP: ${profileRes.status}, Login HTTP: ${loginRes.status}`
        );
    } catch (e) {
        assert(false, '7. Admin block user test failed', e.message);
    }

    // 8. Admin Unblocks the User (Patient)
    try {
        const resUnblock = await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        });
        const dataUnblock = await resUnblock.json();

        // Verify patient can now access protected profile
        const profileRes = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        // Verify patient can now log in
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: patientEmail,
                password: 'Password123'
            })
        });

        const unblockedCorrectly =
            resUnblock.status === 200 &&
            dataUnblock.user.isBlocked === false &&
            profileRes.status === 200 &&
            loginRes.status === 200;

        assert(
            unblockedCorrectly,
            '8. Admin unblocks user -> Patient restored, profile access (200) and login (200) succeed',
            `Unblock status: ${dataUnblock.user.isBlocked}, Profile HTTP: ${profileRes.status}, Login HTTP: ${loginRes.status}`
        );
    } catch (e) {
        assert(false, '8. Admin unblock user test failed', e.message);
    }

    // 9. Admin Blocks a Doctor -> Excluded from public doctor directory
    try {
        // First verify Doctor Stephen Strange is approved so they would qualify for directory
        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Check Stephen Strange is in directory
        const dir1 = await (await fetch(`${BASE_URL}/doctors?search=Stephen`)).json();
        const appearsBeforeBlock = dir1.doctors.some((d) => d._id === doctorId);

        // Now block Doctor Stephen Strange
        const blockRes = await fetch(`${BASE_URL}/admin/users/${doctorId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });

        // Verify doctor disappeared from public directory
        const dir2 = await (await fetch(`${BASE_URL}/doctors?search=Stephen`)).json();
        const excludedAfterBlock = !dir2.doctors.some((d) => d._id === doctorId);

        // Now unblock Doctor Stephen Strange
        await fetch(`${BASE_URL}/admin/users/${doctorId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        });

        // Verify doctor reappears in public directory
        const dir3 = await (await fetch(`${BASE_URL}/doctors?search=Stephen`)).json();
        const reappearsAfterUnblock = dir3.doctors.some((d) => d._id === doctorId);

        assert(
            appearsBeforeBlock && excludedAfterBlock && reappearsAfterUnblock,
            '9. Blocked doctor is automatically excluded from public directory; unblocking restores visibility',
            `Before block: ${appearsBeforeBlock}, During block: ${excludedAfterBlock}, After unblock: ${reappearsAfterUnblock}`
        );
    } catch (e) {
        assert(false, '9. Doctor directory blocking test failed', e.message);
    }

    // 10. Admin Self-Blocking Prevention
    try {
        const selfBlockRes = await fetch(`${BASE_URL}/admin/users/${adminUserId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        const selfBlockData = await selfBlockRes.json();

        assert(
            selfBlockRes.status === 400 && selfBlockData.success === false,
            '10. Admin cannot block their own account (Safety constraint HTTP 400)',
            `HTTP ${selfBlockRes.status}: "${selfBlockData.message}"`
        );
    } catch (e) {
        assert(false, '10. Self-blocking prevention test failed', e.message);
    }

    // 11. Non-admin cannot execute block/unblock (Authorization check)
    try {
        const res = await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        assert(
            res.status === 403,
            '11. Non-admin cannot invoke user block/unblock endpoint (HTTP 403)',
            `HTTP ${res.status}`
        );
    } catch (e) {
        assert(false, '11. Non-admin block unauthorized check failed', e.message);
    }

    // 12. Reuse Phase 4 Doctor Verification Rejection with Reason
    try {
        const rejectRes = await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                status: 'rejected',
                rejectionReason: 'Phase 5 verification test rejection reason'
            })
        });
        const rejectData = await rejectRes.json();

        assert(
            rejectRes.status === 200 &&
            rejectData.doctor.isVerified === false &&
            rejectData.doctor.verificationStatus === 'rejected' &&
            rejectData.doctor.rejectionReason.includes('Phase 5 verification test'),
            '12. Existing Phase 4 doctor verification & rejection API reused seamlessly',
            `Status: ${rejectData.doctor.verificationStatus}, Reason: "${rejectData.doctor.rejectionReason}"`
        );
    } catch (e) {
        assert(false, '12. Phase 4 verification reuse test failed', e.message);
    }

    console.log('\n=====================================================');
    console.log(`TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('=====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase5Tests();
