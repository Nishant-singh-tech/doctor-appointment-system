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
    console.log('   INDEPENDENT VERIFICATION FOR PHASE 4 FEATURES     ');
    console.log('=====================================================\n');

    // 1. Backend startup and MongoDB connection check
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const isConnected = mongoose.connection.readyState === 1;
        recordTest(
            1,
            'Backend starts and connects to MongoDB',
            isConnected,
            `Mongoose readyState = ${mongoose.connection.readyState} (Host: ${mongoose.connection.host})`
        );
    } catch (err) {
        recordTest(1, 'Backend starts and connects to MongoDB', false, err.message);
        process.exit(1);
    }

    // Setup: Admin token
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
    } catch (err) {
        console.error('Admin setup failed:', err);
        process.exit(1);
    }

    // Setup: Create Doctor 1 and Doctor 2
    let doc1Token = '', doc1Id = '', doc1Email = `doctor1_${Date.now()}@test.com`;
    let doc2Token = '', doc2Id = '', doc2Email = `doctor2_${Date.now()}@test.com`;
    let patientToken = '', patientEmail = `patient_test_${Date.now()}@test.com`;

    try {
        const d1Res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. John Watson',
                email: doc1Email,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '555-0191',
                specialization: 'General Surgery'
            })
        });
        const d1Data = await d1Res.json();
        doc1Token = d1Data.token;
        doc1Id = d1Data.user._id;

        const d2Res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Leonard McCoy',
                email: doc2Email,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '555-0192',
                specialization: 'Space Medicine'
            })
        });
        const d2Data = await d2Res.json();
        doc2Token = d2Data.token;
        doc2Id = d2Data.user._id;

        const pRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Sherlock Holmes',
                email: patientEmail,
                password: 'Password123',
                role: 'patient',
                phone: '555-0193'
            })
        });
        const pData = await pRes.json();
        patientToken = pData.token;
    } catch (err) {
        console.error('Setup registration failed:', err);
        process.exit(1);
    }

    // 2. Doctor can view and update their own professional profile
    try {
        // View profile
        const viewRes = await fetch(`${BASE_URL}/doctors/profile/me`, {
            headers: { 'Authorization': `Bearer ${doc1Token}` }
        });
        const viewData = await viewRes.json();

        // Update profile
        const updateRes = await fetch(`${BASE_URL}/doctors/profile/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                name: 'Dr. John H. Watson, MD',
                specialization: 'Trauma & General Surgery',
                qualifications: 'MBBS, MS (Surgery) - King’s College London',
                experience: 12,
                fees: 850,
                location: 'London, UK',
                hospital: 'St. Jude Medical Center',
                about: 'Senior surgical consultant with extensive experience in trauma care.'
            })
        });
        const updateData = await updateRes.json();

        const success =
            viewRes.status === 200 &&
            viewData.doctor.email === doc1Email &&
            updateRes.status === 200 &&
            updateData.doctor.name === 'Dr. John H. Watson, MD' &&
            updateData.doctor.fees === 850 &&
            updateData.doctor.experience === 12;

        recordTest(
            2,
            'Doctor can view and update their own professional profile',
            success,
            `View HTTP ${viewRes.status}; Update HTTP ${updateRes.status} (Name: "${updateData.doctor.name}", Fee: ₹${updateData.doctor.fees}, Exp: ${updateData.doctor.experience} yrs)`
        );
    } catch (err) {
        recordTest(2, 'Doctor can view and update their own professional profile', false, err.message);
    }

    // 3. Ownership security: Doctor cannot modify another doctor's profile
    try {
        // Doctor 1 attempts to modify Doctor 2's profile by injecting doc2Id in payload
        await fetch(`${BASE_URL}/doctors/profile/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                _id: doc2Id,
                fees: 9999
            })
        });

        // Verify Doctor 2 in DB is untouched
        const doc2InDB = await User.findById(doc2Id);
        const untouched = doc2InDB.name === 'Dr. Leonard McCoy' && doc2InDB.fees === 0;

        recordTest(
            3,
            "Ownership check: Doctor cannot modify another doctor's profile",
            untouched,
            `Injected ID payload by Doctor 1 was ignored. Doctor 2 in MongoDB remains fee: ₹${doc2InDB.fees}, name: "${doc2InDB.name}". Identity strictly locked to JWT.`
        );
    } catch (err) {
        recordTest(3, "Ownership check: Doctor cannot modify another doctor's profile", false, err.message);
    }

    // 4. Doctor submits verification document & verification status tracking
    try {
        const subRes = await fetch(`${BASE_URL}/doctors/verification/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                title: 'General Medical Council License #GMC-778899',
                documentUrl: 'https://gmc-uk.org/verify/778899',
                documentType: 'Medical License'
            })
        });
        const subData = await subRes.json();
        const verifiedDoc =
            subRes.status === 200 &&
            subData.success &&
            subData.verificationStatus === 'pending' &&
            subData.documents.length === 1;

        recordTest(
            4,
            'Doctor submits verification documents and tracks status (pending)',
            verifiedDoc,
            `HTTP ${subRes.status}: verificationStatus="${subData.verificationStatus}", Document: "${subData.documents[0].title}"`
        );
    } catch (err) {
        recordTest(4, 'Doctor submits verification documents and tracks status', false, err.message);
    }

    // 5. Unauthorized verification approval rejected (Doctors & Patients cannot approve verification)
    try {
        // Doctor tries to approve
        const docApproveRes = await fetch(`${BASE_URL}/admin/doctors/${doc1Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Patient tries to approve
        const patientApproveRes = await fetch(`${BASE_URL}/admin/doctors/${doc1Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        const rejected = docApproveRes.status === 403 && patientApproveRes.status === 403;
        recordTest(
            5,
            'Unauthorized approval rejected (non-admins receive HTTP 403 Forbidden)',
            rejected,
            `Doctor attempt: HTTP ${docApproveRes.status}; Patient attempt: HTTP ${patientApproveRes.status}`
        );
    } catch (err) {
        recordTest(5, 'Unauthorized approval rejection test failed', false, err.message);
    }

    // 6. Admin approves doctor verification -> Doctor isVerified=true & appears in directory
    try {
        const verifyRes = await fetch(`${BASE_URL}/admin/doctors/${doc1Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });
        const verifyData = await verifyRes.json();

        // Check public directory
        const dirRes = await fetch(`${BASE_URL}/doctors?search=Watson`);
        const dirData = await dirRes.json();
        const inDirectory = dirData.doctors.some((d) => d._id === doc1Id);

        const approved =
            verifyRes.status === 200 &&
            verifyData.doctor.isVerified === true &&
            verifyData.doctor.verificationStatus === 'approved' &&
            inDirectory;

        recordTest(
            6,
            'Admin approves doctor verification -> isVerified=true and appears in public directory',
            approved,
            `Admin HTTP ${verifyRes.status}: verificationStatus="${verifyData.doctor.verificationStatus}", isVerified=${verifyData.doctor.isVerified}. Visible in public directory: ${inDirectory}`
        );
    } catch (err) {
        recordTest(6, 'Admin approves doctor verification test failed', false, err.message);
    }

    // 7. Admin rejects doctor verification -> Doctor excluded from public directory
    try {
        // Doctor 2 submits doc then gets rejected
        await fetch(`${BASE_URL}/doctors/verification/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc2Token}`
            },
            body: JSON.stringify({
                title: 'Unaccredited Certificate',
                documentUrl: 'https://bogus.org/cert.pdf',
                documentType: 'Other Credential'
            })
        });

        const rejectRes = await fetch(`${BASE_URL}/admin/doctors/${doc2Id}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                status: 'rejected',
                rejectionReason: 'Institution is not recognized by the National Medical Commission.'
            })
        });
        const rejectData = await rejectRes.json();

        // Check public directory to ensure Doctor 2 is excluded
        const dirRes = await fetch(`${BASE_URL}/doctors?search=McCoy`);
        const dirData = await dirRes.json();
        const excluded = !dirData.doctors.some((d) => d._id === doc2Id);

        const rejected =
            rejectRes.status === 200 &&
            rejectData.doctor.isVerified === false &&
            rejectData.doctor.verificationStatus === 'rejected' &&
            excluded;

        recordTest(
            7,
            'Admin rejects doctor verification -> Doctor excluded from public directory',
            rejected,
            `Admin HTTP ${rejectRes.status}: verificationStatus="${rejectData.doctor.verificationStatus}", isVerified=${rejectData.doctor.isVerified}. Excluded from public directory: ${excluded}`
        );
    } catch (err) {
        recordTest(7, 'Admin rejects doctor verification test failed', false, err.message);
    }

    // 8. Availability configuration: Days, hours, slot duration, break time
    try {
        const availRes = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Wednesday', 'Friday'],
                workingHours: { start: '08:00', end: '16:00' },
                slotDuration: 30,
                breakTime: { start: '12:00', end: '13:00' },
                timeZone: 'Europe/London'
            })
        });
        const availData = await availRes.json();

        const validAvail =
            availRes.status === 200 &&
            availData.success &&
            availData.availability.workingDays.length === 3 &&
            availData.availability.workingHours.start === '08:00' &&
            availData.availability.slotDuration === 30;

        recordTest(
            8,
            'Doctor configures consultation availability (working days, hours, slot duration, break time)',
            validAvail,
            `HTTP ${availRes.status}: Working Days: [${availData.availability.workingDays.join(', ')}], Hours: ${availData.availability.workingHours.start}-${availData.availability.workingHours.end}, Slot: ${availData.availability.slotDuration}m, Break: ${availData.availability.breakTime.start}-${availData.availability.breakTime.end}`
        );
    } catch (err) {
        recordTest(8, 'Availability configuration test failed', false, err.message);
    }

    // 9. Schedule validation: Rejection of inverted hours and overlapping/invalid breaks
    try {
        // Inverted hours
        const invRes = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                workingHours: { start: '17:00', end: '08:00' }
            })
        });
        const invData = await invRes.json();

        // Break outside working hours
        const outBreakRes = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({
                workingHours: { start: '09:00', end: '17:00' },
                breakTime: { start: '07:00', end: '08:00' } // Before start
            })
        });
        const outBreakData = await outBreakRes.json();

        // Invalid slot duration (< 10)
        const badSlotRes = await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doc1Token}`
            },
            body: JSON.stringify({ slotDuration: 5 })
        });
        const badSlotData = await badSlotRes.json();

        const allRejected = invRes.status === 400 && outBreakRes.status === 400 && badSlotRes.status === 400;
        recordTest(
            9,
            'Schedule validation rejects invalid hours, out-of-bounds breaks, and bad slot durations',
            allRejected,
            `Inverted hours: HTTP ${invRes.status} ("${invData.message}"); Out-of-bounds break: HTTP ${outBreakRes.status} ("${outBreakData.message}"); Bad slot: HTTP ${badSlotRes.status} ("${badSlotData.message}")`
        );
    } catch (err) {
        recordTest(9, 'Schedule validation test failed', false, err.message);
    }

    // 10. Public doctor availability preview endpoint
    try {
        const previewRes = await fetch(`${BASE_URL}/doctors/${doc1Id}/availability`);
        const previewData = await previewRes.json();
        const hasPreview =
            previewRes.status === 200 &&
            previewData.success &&
            previewData.doctorName.includes('Watson') &&
            previewData.availability.workingDays.length === 3;

        recordTest(
            10,
            'Public doctor availability preview endpoint works for verified active doctor',
            hasPreview,
            `HTTP ${previewRes.status}: Doctor "${previewData.doctorName}" (Slot: ${previewData.availability.slotDuration} min, Days: ${previewData.availability.workingDays.join(', ')})`
        );
    } catch (err) {
        recordTest(10, 'Public doctor availability test failed', false, err.message);
    }

    await mongoose.disconnect();
    console.log('=====================================================');
    const totalPassed = results.filter((r) => r.passed).length;
    console.log(`VERIFICATION SUMMARY: ${totalPassed}/${results.length} PASSED`);
    console.log('=====================================================');

    process.exit(totalPassed === results.length ? 0 : 1);
}

runVerification();
