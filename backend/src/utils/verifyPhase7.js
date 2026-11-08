import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import { generateTestSignature, verifyRazorpaySignature } from '../config/razorpay.js';

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

async function runPhase7Verification() {
    console.log('================================================================');
    console.log('   PHASE 7: ONLINE PAYMENT (RAZORPAY) VERIFICATION & AUDIT      ');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    // -------------------------------------------------------------
    // 1. Direct MongoDB Connection & Payment Schema Integrity
    // -------------------------------------------------------------
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const isConnected = mongoose.connection.readyState === 1;

        const paymentIndexes = await Payment.collection.indexes();
        const hasOrderIndex = paymentIndexes.some((idx) => idx.key.orderId === 1);
        const hasApptIndex = paymentIndexes.some((idx) => idx.key.appointment === 1);

        const ok = isConnected && hasOrderIndex && hasApptIndex;
        recordTest(
            1,
            'Database Connection & Payment Model Schema Integrity',
            ok,
            `Connected to ${mongoose.connection.host}, orderId index: ${hasOrderIndex}, appointment index: ${hasApptIndex}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(1, 'Database Connection & Payment Model Schema Integrity', false, err.message);
        failed++;
        process.exit(1);
    }

    // -------------------------------------------------------------
    // 2. Unit Cryptographic Verification: Server-Side HMAC-SHA256 Algorithm
    // -------------------------------------------------------------
    try {
        const testOrderId = 'order_unit_test_98765';
        const testPaymentId = 'pay_unit_test_54321';
        const authenticSig = generateTestSignature({ orderId: testOrderId, paymentId: testPaymentId });

        const verifiedValid = verifyRazorpaySignature({
            orderId: testOrderId,
            paymentId: testPaymentId,
            signature: authenticSig
        });

        const tamperedSig = authenticSig.slice(0, -4) + '0000';
        const verifiedTampered = verifyRazorpaySignature({
            orderId: testOrderId,
            paymentId: testPaymentId,
            signature: tamperedSig
        });

        const ok = verifiedValid === true && verifiedTampered === false;
        recordTest(
            2,
            'Cryptographic Engine Unit: Valid signature passes & tampered signature strictly fails',
            ok,
            `Valid verified: ${verifiedValid}, Tampered rejected: ${!verifiedTampered}`
        );
        if (ok) passed++; else failed++;
    } catch (err) {
        recordTest(2, 'Cryptographic Engine Unit', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------
    // Setup API Testing Accounts
    // -------------------------------------------------------------
    let adminToken = '';
    let doctorToken = '', doctorId = '', docEmail = `p7_audit_doc_${Date.now()}@test.com`;
    let patientAToken = '', patientAId = '';
    let patientBToken = '', patientBId = '';

    try {
        // Admin
        const adminRes = await (await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@hospital.com',
                password: process.env.ADMIN_PASSWORD || 'Admin@123456'
            })
        })).json();
        adminToken = adminRes.token;

        // Doctor
        const docRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Carol Danvers',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 99000 11223',
                specialization: 'Aviation & Hyperbaric Medicine',
                experience: 15,
                fees: 2200
            })
        })).json();
        doctorToken = docRes.token;
        doctorId = docRes.user._id;

        // Verify doctor
        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Set availability
        await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '10:00', end: '15:00' },
                slotDuration: 30,
                breakTime: { start: '12:30', end: '13:00' },
                timeZone: 'Asia/Kolkata'
            })
        });

        // Patient A
        const paRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Wanda Maximoff',
                email: `p7_audit_pa_${Date.now()}@test.com`,
                password: 'Password123',
                role: 'patient',
                phone: '+91 99111 22334'
            })
        })).json();
        patientAToken = paRes.token;
        patientAId = paRes.user._id;

        // Patient B
        const pbRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Vision Synthezoid',
                email: `p7_audit_pb_${Date.now()}@test.com`,
                password: 'Password123',
                role: 'patient',
                phone: '+91 99222 33445'
            })
        })).json();
        patientBToken = pbRes.token;
        patientBId = pbRes.user._id;

        recordTest(
            3,
            'Environment Setup: Admin, Verified Specialist (Dr. Carol Danvers, ₹2200), and 2 Patients Created',
            !!(adminToken && doctorToken && patientAToken && patientBToken),
            `Doctor ID: ${doctorId}, Patient A: Wanda Maximoff, Patient B: Vision`
        );
        passed++;
    } catch (e) {
        recordTest(3, 'Environment Setup', false, e.message);
        failed++;
        process.exit(1);
    }

    const getNextWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getNextWeekday(2);

    // -------------------------------------------------------------
    // 4. Booking Consultation & Verifying Initial State: paymentStatus = 'pending'
    // -------------------------------------------------------------
    let apptId = '';
    try {
        const res = await (await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: '10:00 - 10:30',
                reason: 'Altitude sickness consultation'
            })
        })).json();
        apptId = res.appointment._id;

        const dbAppt = await Appointment.findById(apptId);
        const ok = dbAppt && dbAppt.paymentStatus === 'pending' && dbAppt.fees === 2200;

        recordTest(
            4,
            'Database Ground Truth: Initial Appointment paymentStatus defaults to "pending"',
            ok,
            `Appt ID: ${apptId}, DB paymentStatus: "${dbAppt?.paymentStatus}", DB fee: ₹${dbAppt?.fees}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(4, 'Initial Booking State', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 5. Razorpay Order Generation: Server-Side Creation & Subunit Accuracy
    // -------------------------------------------------------------
    let rzpOrderId = '';
    try {
        const res = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId: apptId })
        });
        const data = await res.json();
        rzpOrderId = data.orderId;

        // ₹2200 * 100 = 220000 Paise
        const dbPayment = await Payment.findOne({ orderId: rzpOrderId });
        const ok =
            res.status === 200 &&
            data.success &&
            data.amount === 220000 &&
            data.amountInRupees === 2200 &&
            dbPayment &&
            dbPayment.status === 'created' &&
            dbPayment.amount === 2200;

        recordTest(
            5,
            'Razorpay Order Generation: Correct 220000 Paise conversion & Payment record created in DB',
            ok,
            `Order ID: ${rzpOrderId}, DB Payment status: "${dbPayment?.status}", Amount in paise: ${data.amount}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(5, 'Razorpay Order Generation', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 6. Access Control: Anonymous or Wrong User Blocked from Generating Order
    // -------------------------------------------------------------
    try {
        const anonRes = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appointmentId: apptId })
        });

        const wrongUserRes = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({ appointmentId: apptId })
        });

        const ok = anonRes.status === 401 && wrongUserRes.status === 403;
        recordTest(
            6,
            'Access Control: Anonymous requests rejected (HTTP 401) & unauthorized patients blocked (HTTP 403)',
            ok,
            `Anonymous: HTTP ${anonRes.status}, Unauthorized user: HTTP ${wrongUserRes.status}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(6, 'Access Control Audit', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 7. Security Audit: Server Strictly Rejects Fake / Tampered Payment Signatures
    // Never trust payment success reported only by frontend!
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId: apptId,
                razorpay_order_id: rzpOrderId,
                razorpay_payment_id: 'pay_spoofed_8899',
                razorpay_signature: 'inauthentic_fake_hash_value'
            })
        });
        const data = await res.json();

        // Database check: verify appointment was NOT prematurely marked as paid!
        const dbAppt = await Appointment.findById(apptId);
        const ok = res.status === 400 && data.success === false && dbAppt.paymentStatus !== 'paid';

        recordTest(
            7,
            'Security Audit: Tampered payment signatures rejected (HTTP 400); Database state protected',
            ok,
            `HTTP ${res.status}: "${data.message}", DB paymentStatus remains: "${dbAppt?.paymentStatus}"`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(7, 'Security Signature Audit', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 8. Server-Side Signature Verification & Payment Capture
    // -------------------------------------------------------------
    const authenticPaymentId = `pay_verified_${Date.now()}`;
    const validSignature = generateTestSignature({ orderId: rzpOrderId, paymentId: authenticPaymentId });

    try {
        const res = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId: apptId,
                razorpay_order_id: rzpOrderId,
                razorpay_payment_id: authenticPaymentId,
                razorpay_signature: validSignature
            })
        });
        const data = await res.json();

        // Ground truth verification directly from MongoDB
        const dbAppt = await Appointment.findById(apptId);
        const dbPayment = await Payment.findOne({ orderId: rzpOrderId });

        const ok =
            res.status === 200 &&
            data.success &&
            dbAppt.paymentStatus === 'paid' &&
            dbAppt.paymentDetails.razorpayPaymentId === authenticPaymentId &&
            dbPayment.status === 'captured';

        recordTest(
            8,
            'Payment Capture: Cryptographic signature validated; DB records updated to "paid" and "captured"',
            ok,
            `DB Appointment paymentStatus: "${dbAppt?.paymentStatus}", DB Payment status: "${dbPayment?.status}", Payment ID: ${dbAppt?.paymentDetails?.razorpayPaymentId}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(8, 'Payment Capture Test', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 9. Concurrency & Duplicate Payment Guard
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId: apptId })
        });
        const data = await res.json();
        const ok = res.status === 400 && data.success === false && data.message.includes('already been paid');

        recordTest(
            9,
            'Concurrency Guard: Re-attempting payment on already-paid appointment rejected (HTTP 400)',
            ok,
            `HTTP ${res.status}: "${data.message}"`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(9, 'Duplicate Payment Guard', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 10. Automatic Refund Triggered by Appointment Cancellation
    // -------------------------------------------------------------
    try {
        const cancelRes = await (await fetch(`${BASE_URL}/appointments/${apptId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ cancellationReason: 'Urgent family event' })
        })).json();

        // Ground truth check in DB
        const dbAppt = await Appointment.findById(apptId);
        const dbPayment = await Payment.findOne({ appointment: apptId });

        const ok =
            dbAppt.status === 'cancelled' &&
            dbAppt.paymentStatus === 'refunded' &&
            dbPayment.status === 'refunded' &&
            !!dbAppt.paymentDetails.refundId;

        recordTest(
            10,
            'Automatic Refund: Cancelling paid appointment automatically transitions DB state to "refunded"',
            ok,
            `DB Status: ${dbAppt?.status}, DB PaymentStatus: ${dbAppt?.paymentStatus}, Refund ID: ${dbAppt?.paymentDetails?.refundId}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(10, 'Cancellation Refund Test', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 11. Payment Audit Trail & Transaction Listing
    // -------------------------------------------------------------
    try {
        const res = await (await fetch(`${BASE_URL}/payments/appointment/${apptId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        })).json();

        const ok = res.success === true && res.payments.length >= 1 && res.paymentStatus === 'refunded';
        recordTest(
            11,
            'Audit Trail: Appointment payment audit history retrieved with all relational metadata',
            ok,
            `Transaction count: ${res.count}, Status: ${res.paymentStatus}, Order: ${res.payments[0]?.orderId}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(11, 'Audit Trail Test', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------
    // 12. Admin System Statistics: 100% Match with Database Ground Truth
    // -------------------------------------------------------------
    try {
        const statsRes = await (await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })).json();

        // Calculate database ground truth directly via Mongoose
        const dbPaidCount = await Appointment.countDocuments({ paymentStatus: 'paid' });
        const dbRefundedCount = await Appointment.countDocuments({ paymentStatus: 'refunded' });
        const dbRevenueAgg = await Appointment.aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$fees' } } }
        ]);
        const dbRevenue = (dbRevenueAgg && dbRevenueAgg[0] && dbRevenueAgg[0].total) || 0;

        const apiStats = statsRes.stats;
        const ok =
            apiStats.paidAppointments === dbPaidCount &&
            apiStats.refundedPayments === dbRefundedCount &&
            apiStats.totalRevenue === dbRevenue;

        recordTest(
            12,
            'Admin Statistics Audit: Revenue & payment metrics match database ground truth 100%',
            ok,
            `DB vs API -> Revenue: ₹${dbRevenue} vs ₹${apiStats.totalRevenue}, Paid: ${dbPaidCount} vs ${apiStats.paidAppointments}, Refunded: ${dbRefundedCount} vs ${apiStats.refundedPayments}`
        );
        if (ok) passed++; else failed++;
    } catch (e) {
        recordTest(12, 'Admin Statistics Audit', false, e.message);
        failed++;
    }

    await mongoose.disconnect();

    console.log('================================================================');
    console.log(`PHASE 7 VERIFICATION SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase7Verification();

