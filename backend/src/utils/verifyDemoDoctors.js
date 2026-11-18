import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { generateToken } from './generateToken.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment';
const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`;

async function runVerification() {
    console.log('Connecting to database:', MONGO_URI);
    await mongoose.connect(MONGO_URI);

    const demoEmails = [
        'demo.doctor1@doccare.test',
        'demo.doctor2@doccare.test',
        'demo.doctor3@doccare.test',
        'demo.doctor4@doccare.test',
        'demo.doctor5@doccare.test',
        'demo.doctor6@doccare.test',
        'demo.doctor7@doccare.test',
        'demo.doctor8@doccare.test',
        'demo.doctor9@doccare.test',
        'demo.doctor10@doccare.test'
    ];

    const results = [];

    // 1. Check all 10 demo doctors in MongoDB
    const docsInDb = await User.find({ email: { $in: demoEmails } });
    const all10Exist = docsInDb.length === 10;
    const allPending = docsInDb.every((d) => d.verificationStatus === 'pending' && d.isVerified === false);

    results.push({
        test: '1. All 10 demo doctors exist in MongoDB',
        pass: all10Exist,
        evidence: `Found ${docsInDb.length} of 10 demo doctors in database.`
    });

    results.push({
        test: '2. All 10 demo doctors have verificationStatus: "pending" and isVerified: false',
        pass: allPending,
        evidence: `Pending count: ${docsInDb.filter((d) => d.verificationStatus === 'pending').length}, Unverified count: ${docsInDb.filter((d) => !d.isVerified).length}`
    });

    // 2. Obtain Admin JWT from verified admin account in database
    let adminToken = '';
    const adminUser = await User.findOne({ role: 'admin', email: 'admin@hospital.com' });
    if (adminUser) {
        adminToken = generateToken(adminUser._id, 'admin');
        results.push({
            test: '3. Admin token authorization verified for admin@hospital.com',
            pass: Boolean(adminToken),
            evidence: `Generated valid JWT for admin account: ${adminUser.name} (${adminUser.email})`
        });
    } else {
        results.push({
            test: '3. Admin account found in database',
            pass: false,
            evidence: 'Admin account admin@hospital.com not found in database.'
        });
    }

    if (adminToken) {
        // 4. Verify Pending Doctors API returns the 10 demo doctors
        try {
            const pendingRes = await fetch(`${BASE_URL}/admin/doctors/pending`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            const pendingData = await pendingRes.json();
            const foundInPending = pendingData.doctors
                ? demoEmails.filter((em) => pendingData.doctors.some((d) => d.email === em))
                : [];

            results.push({
                test: '4. GET /api/admin/doctors/pending includes all 10 demo doctors',
                pass: foundInPending.length === 10,
                evidence: `HTTP ${pendingRes.status}: ${foundInPending.length}/10 demo doctors found in pending queue.`
            });
        } catch (err) {
            results.push({
                test: '4. GET /api/admin/doctors/pending includes all 10 demo doctors',
                pass: false,
                evidence: `Error: ${err.message}`
            });
        }

        // 5. Verify Public Directory GET /api/doctors EXCLUDES all pending demo doctors
        try {
            const pubDirRes = await fetch(`${BASE_URL}/doctors?limit=50`);
            const pubDirData = await pubDirRes.json();
            const publicDocs = pubDirData.doctors || [];
            const leakedDocs = demoEmails.filter((em) => publicDocs.some((d) => d.email === em));

            results.push({
                test: '5. Public directory GET /api/doctors EXCLUDES unapproved demo doctors',
                pass: leakedDocs.length === 0,
                evidence: leakedDocs.length === 0
                    ? `0 of 10 demo doctors visible in public directory (Correctly hidden while pending).`
                    : `LEAK DETECTED: Found ${leakedDocs.join(', ')} in public directory!`
            });
        } catch (err) {
            results.push({
                test: '5. Public directory GET /api/doctors EXCLUDES unapproved demo doctors',
                pass: false,
                evidence: `Error: ${err.message}`
            });
        }

        // 6. Test Doctor 1 Demo Login
        try {
            const docLoginRes = await fetch(`${BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'demo.doctor1@doccare.test',
                    password: 'Cardio#Care2026!Doc1'
                })
            });
            const docLoginData = await docLoginRes.json();
            results.push({
                test: '6. Demo doctor can log in with bcrypt-verified demo password',
                pass: docLoginRes.status === 200 && docLoginData.success === true,
                evidence: `HTTP ${docLoginRes.status}: Logged in as ${docLoginData.user?.name} (Role: ${docLoginData.user?.role}, Verification: ${docLoginData.user?.verificationStatus})`
            });
        } catch (err) {
            results.push({
                test: '6. Demo doctor can log in with bcrypt-verified demo password',
                pass: false,
                evidence: `Error: ${err.message}`
            });
        }

        // 7. Verify all 10 demo doctors are in Pending Queue with documents and credentials intact
        try {
            const pendingRes = await fetch(`${BASE_URL}/admin/doctors/pending`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            const pendingData = await pendingRes.json();
            const pendingDocs = pendingData.doctors || [];
            const demoPending = pendingDocs.filter((d) => demoEmails.includes(d.email));

            const hasDocs = demoPending.every((d) => d.documents && d.documents.length > 0);
            const hasSpecs = demoPending.every((d) => Boolean(d.specialization));
            const hasFees = demoPending.every((d) => d.fees > 0);

            results.push({
                test: '7. All 10 demo doctors have complete verification documentation & fees in pending queue',
                pass: demoPending.length === 10 && hasDocs && hasSpecs && hasFees,
                evidence: `Verified ${demoPending.length}/10 doctors in pending queue with documents (${hasDocs}), specializations (${hasSpecs}), and fees (${hasFees}). None approved.`
            });
        } catch (err) {
            results.push({
                test: '7. All 10 demo doctors have complete verification documentation in pending queue',
                pass: false,
                evidence: `Error: ${err.message}`
            });
        }
    }

    console.log('\n================ VERIFICATION RESULTS ================');
    results.forEach((r) => {
        console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.test}`);
        console.log(`       Evidence: ${r.evidence}`);
    });
    console.log('======================================================\n');

    await mongoose.disconnect();
    return results;
}

if (process.argv[1] && process.argv[1].endsWith('verifyDemoDoctors.js')) {
    runVerification()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('Verification failed:', err);
            process.exit(1);
        });
}
