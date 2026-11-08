import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runComprehensiveVerification() {
    console.log('================================================================');
    console.log('    PHASE 5 INDEPENDENT 14-AREA VERIFICATION & SECURITY AUDIT   ');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    const assert = (condition, areaNumber, title, evidence) => {
        if (condition) {
            console.log(`[PASS] Area ${areaNumber}: ${title}`);
            if (evidence) console.log(`       Evidence: ${evidence}`);
            passed++;
        } else {
            console.error(`[FAIL] Area ${areaNumber}: ${title}`);
            if (evidence) console.error(`       Evidence: ${evidence}`);
            failed++;
        }
    };

    // 0. Connect directly to MongoDB to establish ground truth
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');

    // Setup Admin
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'admin@hospital.com',
            password: process.env.ADMIN_PASSWORD || 'Admin@123456'
        })
    });
    const adminData = await adminLoginRes.json();
    const adminToken = adminData.token;
    const adminId = adminData.user._id;

    // Setup fresh test patient
    const testPatientEmail = `audit_patient_${Date.now()}@test.com`;
    const patientRegRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Audit Test Patient',
            email: testPatientEmail,
            password: 'PatientPassword123',
            role: 'patient',
            phone: '+1 555-8899'
        })
    });
    const patientData = await patientRegRes.json();
    const patientToken = patientData.token;
    const patientId = patientData.user._id;

    // Setup fresh test doctor
    const testDocEmail = `audit_doc_${Date.now()}@test.com`;
    const docRegRes = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Dr. Audit Specialist',
            email: testDocEmail,
            password: 'DoctorPassword123',
            role: 'doctor',
            phone: '+1 555-9900',
            specialization: 'Pulmonology',
            experience: 14,
            fees: 1100
        })
    });
    const docData = await docRegRes.json();
    const docToken = docData.token;
    const docId = docData.user._id;

    // -------------------------------------------------------------------------
    // 1. Admin dashboard loads correctly (Backend health & Dashboard APIs accessible)
    // -------------------------------------------------------------------------
    try {
        const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const usersRes = await fetch(`${BASE_URL}/admin/users?limit=1`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const docsRes = await fetch(`${BASE_URL}/admin/doctors?limit=1`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const ok = statsRes.status === 200 && usersRes.status === 200 && docsRes.status === 200;
        assert(
            ok,
            1,
            'Admin dashboard APIs load correctly',
            `Stats: HTTP ${statsRes.status}, Users: HTTP ${usersRes.status}, Doctors: HTTP ${docsRes.status}`
        );
    } catch (e) {
        assert(false, 1, 'Admin dashboard load failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 2. Non-admin users cannot access /admin APIs
    // -------------------------------------------------------------------------
    try {
        const patientAttempt = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });
        const docAttempt = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${docToken}` }
        });
        const anonAttempt = await fetch(`${BASE_URL}/admin/stats`);

        const ok = patientAttempt.status === 403 && docAttempt.status === 403 && anonAttempt.status === 401;
        assert(
            ok,
            2,
            'Non-admin users cannot access admin endpoints',
            `Patient: HTTP ${patientAttempt.status}, Doctor: HTTP ${docAttempt.status}, Anonymous: HTTP ${anonAttempt.status}`
        );
    } catch (e) {
        assert(false, 2, 'Non-admin access test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 3. Admin statistics display accurate database values
    // -------------------------------------------------------------------------
    try {
        const [
            dbTotalUsers,
            dbTotalPatients,
            dbTotalDoctors,
            dbVerifiedDoctors,
            dbPendingVerifications,
            dbBlockedUsers
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ role: 'patient' }),
            User.countDocuments({ role: 'doctor' }),
            User.countDocuments({ role: 'doctor', isVerified: true }),
            User.countDocuments({ role: 'doctor', verificationStatus: 'pending' }),
            User.countDocuments({ isBlocked: true })
        ]);

        const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const statsData = await statsRes.json();
        const apiStats = statsData.stats;

        const exactMatch =
            apiStats.totalUsers === dbTotalUsers &&
            apiStats.totalPatients === dbTotalPatients &&
            apiStats.totalDoctors === dbTotalDoctors &&
            apiStats.verifiedDoctors === dbVerifiedDoctors &&
            apiStats.pendingVerifications === dbPendingVerifications &&
            apiStats.blockedUsers === dbBlockedUsers;

        assert(
            exactMatch,
            3,
            'Admin statistics match database ground truth 100%',
            `DB vs API -> Users: ${dbTotalUsers} vs ${apiStats.totalUsers}, Patients: ${dbTotalPatients} vs ${apiStats.totalPatients}, Doctors: ${dbTotalDoctors} vs ${apiStats.totalDoctors}, Verified: ${dbVerifiedDoctors} vs ${apiStats.verifiedDoctors}, Blocked: ${dbBlockedUsers} vs ${apiStats.blockedUsers}`
        );
    } catch (e) {
        assert(false, 3, 'Stats accuracy check failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 4. User listing works
    // -------------------------------------------------------------------------
    try {
        const usersRes = await fetch(`${BASE_URL}/admin/users?limit=5`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const usersData = await usersRes.json();
        const validListing =
            usersRes.status === 200 &&
            usersData.success &&
            Array.isArray(usersData.users) &&
            usersData.users.length > 0 &&
            usersData.users[0].name &&
            usersData.users[0].email;

        assert(
            validListing,
            4,
            'User listing works with complete user metadata',
            `Returned ${usersData.users?.length} users, Total users in system: ${usersData.totalUsers}`
        );
    } catch (e) {
        assert(false, 4, 'User listing test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 5. User search works
    // -------------------------------------------------------------------------
    try {
        const searchRes = await fetch(`${BASE_URL}/admin/users?search=${encodeURIComponent(testPatientEmail)}`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const searchData = await searchRes.json();
        const searchWorks =
            searchRes.status === 200 &&
            searchData.users.length === 1 &&
            searchData.users[0]._id === patientId;

        assert(
            searchWorks,
            5,
            'User search finds exact matching user record by email',
            `Matched: ${searchData.users[0]?.name} (${searchData.users[0]?.email})`
        );
    } catch (e) {
        assert(false, 5, 'User search test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 6. User pagination works
    // -------------------------------------------------------------------------
    try {
        const p1Res = await fetch(`${BASE_URL}/admin/users?page=1&limit=2`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const p1Data = await p1Res.json();

        const p2Res = await fetch(`${BASE_URL}/admin/users?page=2&limit=2`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const p2Data = await p2Res.json();

        const paginationWorks =
            p1Res.status === 200 &&
            p2Res.status === 200 &&
            p1Data.users.length === 2 &&
            p2Data.users.length === 2 &&
            p1Data.users[0]._id !== p2Data.users[0]._id &&
            p1Data.pages > 1;

        assert(
            paginationWorks,
            6,
            'User pagination returns distinct page sets and valid metadata',
            `Page 1 ID: ${p1Data.users[0]?._id}, Page 2 ID: ${p2Data.users[0]?._id}, Total Pages: ${p1Data.pages}`
        );
    } catch (e) {
        assert(false, 6, 'User pagination test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 7. Doctor listing works
    // -------------------------------------------------------------------------
    try {
        const docRes = await fetch(`${BASE_URL}/admin/doctors?limit=5`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const docData = await docRes.json();
        const validListing =
            docRes.status === 200 &&
            docData.success &&
            Array.isArray(docData.doctors) &&
            docData.doctors.every((d) => d.role === 'doctor');

        assert(
            validListing,
            7,
            'Doctor listing returns only accounts with role="doctor"',
            `Count: ${docData.doctors.length}, Total Doctors: ${docData.totalDoctors}`
        );
    } catch (e) {
        assert(false, 7, 'Doctor listing test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 8. Doctor search and filtering work
    // -------------------------------------------------------------------------
    try {
        // Search by specialization
        const searchRes = await fetch(`${BASE_URL}/admin/doctors?search=Pulmonology`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const searchData = await searchRes.json();

        // Filter by verification status
        const filterRes = await fetch(`${BASE_URL}/admin/doctors?verificationStatus=pending`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const filterData = await filterRes.json();

        const searchOk = searchData.doctors.some((d) => d._id === docId);
        const filterOk = filterData.doctors.every((d) => d.verificationStatus === 'pending');

        assert(
            searchOk && filterOk,
            8,
            'Doctor search by specialty and verificationStatus filter work as expected',
            `Found Pulmonologist: ${searchOk}, All filtered pending: ${filterOk}`
        );
    } catch (e) {
        assert(false, 8, 'Doctor search and filter test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 9. Admin can block a patient
    // -------------------------------------------------------------------------
    try {
        const blockRes = await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        const blockData = await blockRes.json();

        const dbPatient = await User.findById(patientId);

        assert(
            blockRes.status === 200 && blockData.user.isBlocked === true && dbPatient.isBlocked === true,
            9,
            'Admin can block a patient account',
            `API response isBlocked: ${blockData.user?.isBlocked}, DB isBlocked: ${dbPatient.isBlocked}`
        );
    } catch (e) {
        assert(false, 9, 'Block patient test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 10. Admin can unblock a patient
    // -------------------------------------------------------------------------
    try {
        const unblockRes = await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        });
        const unblockData = await unblockRes.json();

        const dbPatient = await User.findById(patientId);

        assert(
            unblockRes.status === 200 && unblockData.user.isBlocked === false && dbPatient.isBlocked === false,
            10,
            'Admin can unblock a patient account',
            `API response isBlocked: ${unblockData.user?.isBlocked}, DB isBlocked: ${dbPatient.isBlocked}`
        );
    } catch (e) {
        assert(false, 10, 'Unblock patient test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 11. Admin can block and unblock a doctor
    // -------------------------------------------------------------------------
    try {
        // Approve doctor first
        await fetch(`${BASE_URL}/admin/doctors/${docId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Block doctor
        const bRes = await fetch(`${BASE_URL}/admin/users/${docId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        const bData = await bRes.json();

        // Check excluded from public directory
        const dirAfterBlock = await (await fetch(`${BASE_URL}/doctors?search=Specialist`)).json();
        const excluded = !dirAfterBlock.doctors.some((d) => d._id === docId);

        // Unblock doctor
        const ubRes = await fetch(`${BASE_URL}/admin/users/${docId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        });
        const ubData = await ubRes.json();

        // Check restored in public directory
        const dirAfterUnblock = await (await fetch(`${BASE_URL}/doctors?search=Specialist`)).json();
        const restored = dirAfterUnblock.doctors.some((d) => d._id === docId);

        assert(
            bData.user.isBlocked === true && excluded && ubData.user.isBlocked === false && restored,
            11,
            'Admin can block & unblock a doctor; directory visibility reacts accordingly',
            `Blocked: ${bData.user.isBlocked}, Excluded from directory: ${excluded}, Restored in directory: ${restored}`
        );
    } catch (e) {
        assert(false, 11, 'Doctor block/unblock test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 12. Blocked users cannot access protected backend APIs
    // -------------------------------------------------------------------------
    try {
        // Block patient
        await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });

        // Attempt access to protected patient route
        const protectedAttempt = await fetch(`${BASE_URL}/patients/profile`, {
            headers: { 'Authorization': `Bearer ${patientToken}` }
        });

        // Attempt login
        const loginAttempt = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: testPatientEmail,
                password: 'PatientPassword123'
            })
        });

        // Clean up: unblock
        await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        });

        assert(
            protectedAttempt.status === 403 && loginAttempt.status === 403,
            12,
            'Blocked users rejected from protected APIs and login (HTTP 403)',
            `Protected Profile: HTTP ${protectedAttempt.status}, Login: HTTP ${loginAttempt.status}`
        );
    } catch (e) {
        assert(false, 12, 'Blocked user security check failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 13. Non-admin users cannot access admin APIs
    // -------------------------------------------------------------------------
    try {
        const endpoints = [
            { method: 'GET', url: `${BASE_URL}/admin/stats` },
            { method: 'GET', url: `${BASE_URL}/admin/users` },
            { method: 'GET', url: `${BASE_URL}/admin/doctors` },
            { method: 'GET', url: `${BASE_URL}/admin/doctors/pending` },
            { method: 'PUT', url: `${BASE_URL}/admin/users/${patientId}/block`, body: { isBlocked: true } },
            { method: 'PUT', url: `${BASE_URL}/admin/doctors/${docId}/verify`, body: { status: 'approved' } }
        ];

        let allProtected = true;
        for (const ep of endpoints) {
            const res = await fetch(ep.url, {
                method: ep.method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${patientToken}`
                },
                body: ep.body ? JSON.stringify(ep.body) : undefined
            });
            if (res.status !== 403) {
                allProtected = false;
                console.error(`Failed protection on ${ep.method} ${ep.url}: got HTTP ${res.status}`);
            }
        }

        assert(
            allProtected,
            13,
            'All admin endpoints rigorously enforce HTTP 403 on non-admin tokens',
            `Verified 6 distinct admin endpoints against unauthorized access`
        );
    } catch (e) {
        assert(false, 13, 'Admin endpoint authorization audit failed', e.message);
    }

    // -------------------------------------------------------------------------
    // 14. Admin doctor verification queue and approve/reject operations still work
    // -------------------------------------------------------------------------
    try {
        // Submit verification for docId
        await fetch(`${BASE_URL}/doctors/verification/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${docToken}`
            },
            body: JSON.stringify({
                title: 'State Pulmonology Board License',
                documentUrl: 'https://medical-license-registry.org/pulm/99281.pdf',
                documentType: 'Board Certification'
            })
        });

        // Check appears in pending queue
        const pendingRes = await fetch(`${BASE_URL}/admin/doctors/pending`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const pendingData = await pendingRes.json();
        const inQueue = pendingData.doctors.some((d) => d._id === docId);

        // Approve
        const approveRes = await fetch(`${BASE_URL}/admin/doctors/${docId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });
        const approveData = await approveRes.json();

        // Reject
        const rejectRes = await fetch(`${BASE_URL}/admin/doctors/${docId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                status: 'rejected',
                rejectionReason: 'Board license renewal pending state validation.'
            })
        });
        const rejectData = await rejectRes.json();

        const queueAndVerifyWork =
            inQueue &&
            approveRes.status === 200 &&
            approveData.doctor.isVerified === true &&
            rejectRes.status === 200 &&
            rejectData.doctor.isVerified === false &&
            rejectData.doctor.rejectionReason.includes('renewal pending');

        assert(
            queueAndVerifyWork,
            14,
            'Doctor verification queue, approval, and rejection operate flawlessly',
            `In Queue: ${inQueue}, Approved isVerified: ${approveData.doctor?.isVerified}, Rejected isVerified: ${rejectData.doctor?.isVerified}, Reason: "${rejectData.doctor?.rejectionReason}"`
        );
    } catch (e) {
        assert(false, 14, 'Doctor verification queue test failed', e.message);
    }

    // -------------------------------------------------------------------------
    // ADDITIONAL SECURITY CHECKS
    // -------------------------------------------------------------------------
    console.log('\n--- ADDITIONAL SECURITY CHECKS ---');

    // 15. Admin cannot accidentally block their own account
    try {
        const selfBlockRes = await fetch(`${BASE_URL}/admin/users/${adminId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: true })
        });
        const selfBlockData = await selfBlockRes.json();
        const prevented = selfBlockRes.status === 400 && selfBlockData.message.includes('Admin cannot block their own account');

        assert(
            prevented,
            'SEC-1',
            'Admin cannot accidentally block their own account (Self-lockout prevention)',
            `HTTP ${selfBlockRes.status}: "${selfBlockData.message}"`
        );
    } catch (e) {
        assert(false, 'SEC-1', 'Self-block prevention failed', e.message);
    }

    // 16. Password hashes are never exposed in user or doctor listings
    try {
        const usersRes = await (await fetch(`${BASE_URL}/admin/users?limit=10`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })).json();

        const docsRes = await (await fetch(`${BASE_URL}/admin/doctors?limit=10`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })).json();

        const blockRes = await (await fetch(`${BASE_URL}/admin/users/${patientId}/block`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ isBlocked: false })
        })).json();

        const noPasswordInUsers = usersRes.users.every((u) => u.password === undefined);
        const noPasswordInDocs = docsRes.doctors.every((d) => d.password === undefined);
        const noPasswordInBlock = blockRes.user.password === undefined;

        assert(
            noPasswordInUsers && noPasswordInDocs && noPasswordInBlock,
            'SEC-2',
            'Password hashes are strictly excluded from all user & doctor API responses',
            `Users passwords hidden: ${noPasswordInUsers}, Docs passwords hidden: ${noPasswordInDocs}, Block password hidden: ${noPasswordInBlock}`
        );
    } catch (e) {
        assert(false, 'SEC-2', 'Password hash exposure audit failed', e.message);
    }

    await mongoose.disconnect();

    console.log('\n================================================================');
    console.log(`COMPREHENSIVE AUDIT SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runComprehensiveVerification();
