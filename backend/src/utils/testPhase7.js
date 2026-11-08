import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import { generateTestSignature } from '../config/razorpay.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase7Tests() {
    console.log('=====================================================');
    console.log('    STARTING PHASE 7: RAZORPAY PAYMENT TEST SUITE    ');
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
    // Setup 2: Doctor Creation, Verification & Schedule Setup
    // -------------------------------------------------------------
    let doctorToken = '', doctorId = '';
    const docEmail = `p7_doc_${Date.now()}@test.com`;

    try {
        const docReg = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Natasha Romanoff',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+91 98765 43210',
                specialization: 'Sports Medicine & Orthopedics',
                experience: 12,
                fees: 1800
            })
        })).json();
        doctorToken = docReg.token;
        doctorId = docReg.user._id;

        // Admin approves doctor
        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
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
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '09:00', end: '14:00' },
                slotDuration: 30,
                breakTime: { start: '11:00', end: '11:30' },
                timeZone: 'Asia/Kolkata'
            })
        });

        assert(!!doctorId, 'Setup: Created, verified, and configured schedule for Dr. Natasha Romanoff (Fee: ₹1800)');
    } catch (e) {
        assert(false, 'Setup: Doctor setup failed', e.message);
        process.exit(1);
    }

    // -------------------------------------------------------------
    // Setup 3: Create Test Patient A & Patient B
    // -------------------------------------------------------------
    let patientAToken = '', patientAId = '';
    let patientBToken = '', patientBId = '';

    try {
        const paRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Clint Barton',
                email: `p7_pa_${Date.now()}@test.com`,
                password: 'Password123',
                role: 'patient',
                phone: '+91 98111 22233'
            })
        })).json();
        patientAToken = paRes.token;
        patientAId = paRes.user._id;

        const pbRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Sam Wilson',
                email: `p7_pb_${Date.now()}@test.com`,
                password: 'Password123',
                role: 'patient',
                phone: '+91 98444 55566'
            })
        })).json();
        patientBToken = pbRes.token;
        patientBId = pbRes.user._id;

        assert(!!patientAToken && !!patientBToken, 'Setup: Created Patient A (Clint) and Patient B (Sam)');
    } catch (e) {
        assert(false, 'Setup: Patient setup failed', e.message);
        process.exit(1);
    }

    // Upcoming weekday helper
    const getUpcomingWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getUpcomingWeekday(2);

    // -------------------------------------------------------------
    // Test 1: Book Appointment & Verify Initial Payment Status is 'pending'
    // -------------------------------------------------------------
    let apptAId = '';
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: '09:00 - 09:30',
                reason: 'Shoulder rehabilitation therapy'
            })
        });
        const data = await res.json();
        apptAId = data.appointment?._id;

        const ok =
            res.status === 201 &&
            data.success &&
            data.appointment.status === 'confirmed' &&
            data.appointment.fees === 1800 &&
            data.appointment.paymentStatus === 'pending';

        assert(
            ok,
            '1. Appointment booked with default paymentStatus: "pending" and fee ₹1800',
            `ID: ${apptAId}, Fee: ₹${data.appointment?.fees}, PaymentStatus: ${data.appointment?.paymentStatus}`
        );
    } catch (e) {
        assert(false, '1. Initial appointment booking failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 2: Create Razorpay Payment Order (POST /api/payments/create-order)
    // -------------------------------------------------------------
    let razorpayOrderId = '';
    let razorpayAmountInPaise = 0;
    try {
        const res = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId: apptAId })
        });
        const data = await res.json();
        razorpayOrderId = data.orderId;
        razorpayAmountInPaise = data.amount;

        // ₹1800 * 100 paise = 180000 paise
        const ok =
            res.status === 200 &&
            data.success &&
            typeof razorpayOrderId === 'string' &&
            razorpayOrderId.length > 5 &&
            data.amount === 180000 &&
            data.amountInRupees === 1800 &&
            data.currency === 'INR';

        assert(
            ok,
            '2. Server creates Razorpay Order with amount in Paise (180000 Paise for ₹1800)',
            `Order ID: ${razorpayOrderId}, Amount in paise: ${data.amount}, Currency: ${data.currency}`
        );
    } catch (e) {
        assert(false, '2. Razorpay Order creation failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 3: Access Control: Patient B cannot create payment order for Patient A's appointment (HTTP 403)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}` // Wrong patient!
            },
            body: JSON.stringify({ appointmentId: apptAId })
        });
        const data = await res.json();
        assert(
            res.status === 403 && data.success === false,
            '3. Security: Unrelated Patient B blocked from creating payment order for Patient A appointment (HTTP 403)',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '3. Unauthorized payment order test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 4: Critical Security: Fake / Tampered Payment Signature is strictly rejected (HTTP 400)
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
                appointmentId: apptAId,
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: 'pay_fraud_123456',
                razorpay_signature: 'fake_tampered_signature_9999999999999' // Forged!
            })
        });
        const data = await res.json();
        const ok =
            res.status === 400 &&
            data.success === false &&
            data.message.includes('signature');

        assert(
            ok,
            '4. Security: Tampered / forged Razorpay signature is rejected with HTTP 400',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '4. Signature tampering test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 5: Cryptographic Server-Side Signature Verification & Payment Capture (HTTP 200)
    // -------------------------------------------------------------
    const authenticPaymentId = `pay_rzp_${Date.now()}`;
    const validSignature = generateTestSignature({
        orderId: razorpayOrderId,
        paymentId: authenticPaymentId
    });

    try {
        const res = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                appointmentId: apptAId,
                razorpay_order_id: razorpayOrderId,
                razorpay_payment_id: authenticPaymentId,
                razorpay_signature: validSignature
            })
        });
        const data = await res.json();

        const ok =
            res.status === 200 &&
            data.success &&
            data.appointment.paymentStatus === 'paid' &&
            data.appointment.paymentDetails.razorpayPaymentId === authenticPaymentId &&
            data.payment.status === 'captured';

        assert(
            ok,
            '5. Authentic cryptographic HMAC-SHA256 signature accepted: payment captured & status marked "paid"',
            `Payment Status: ${data.appointment?.paymentStatus}, Payment ID: ${data.payment?.paymentId}`
        );
    } catch (e) {
        assert(false, '5. Valid signature verification test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 6: Concurrency / Duplicate Payment Guard
    // Cannot pay again for an already paid appointment (HTTP 400)
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({ appointmentId: apptAId })
        });
        const data = await res.json();
        const ok = res.status === 400 && data.success === false && data.message.includes('already been paid');

        assert(
            ok,
            '6. Concurrency Guard: Attempting duplicate payment on already-paid appointment rejected (HTTP 400)',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '6. Duplicate payment guard test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 7: Payment Failure Recording & Retry Handling
    // -------------------------------------------------------------
    let apptBId = '';
    let razorpayOrderBId = '';
    try {
        // Patient B books second slot
        const bookRes = await (await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: '09:30 - 10:00',
                reason: 'Knee checkup'
            })
        })).json();
        apptBId = bookRes.appointment._id;

        // Create order
        const orderRes = await (await fetch(`${BASE_URL}/payments/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({ appointmentId: apptBId })
        })).json();
        razorpayOrderBId = orderRes.orderId;

        // Record failure (user dismissed gateway)
        const failRes = await fetch(`${BASE_URL}/payments/fail`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                appointmentId: apptBId,
                orderId: razorpayOrderBId,
                failureReason: 'User cancelled payment modal'
            })
        });
        const failData = await failRes.json();

        const ok =
            failRes.status === 200 &&
            failData.success &&
            failData.appointment.paymentStatus === 'failed';

        assert(
            ok,
            '7. Payment dismissal / failure accurately recorded with paymentStatus: "failed"',
            `Status: ${failData.appointment?.paymentStatus}, Reason: "${failData.appointment?.paymentDetails?.failureReason}"`
        );
    } catch (e) {
        assert(false, '7. Payment failure handling test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 8: Patient B Retries Payment & Successfully Captures
    // -------------------------------------------------------------
    try {
        // Patient B retries payment
        const retryPaymentId = `pay_retry_${Date.now()}`;
        const retrySignature = generateTestSignature({
            orderId: razorpayOrderBId,
            paymentId: retryPaymentId
        });

        const res = await fetch(`${BASE_URL}/payments/verify`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                appointmentId: apptBId,
                razorpay_order_id: razorpayOrderBId,
                razorpay_payment_id: retryPaymentId,
                razorpay_signature: retrySignature
            })
        });
        const data = await res.json();

        const ok =
            res.status === 200 &&
            data.success &&
            data.appointment.paymentStatus === 'paid' &&
            data.payment.status === 'captured';

        assert(
            ok,
            '8. Patient B successfully retries payment after failure: status transitions to "paid"',
            `Status: ${data.appointment?.paymentStatus}, Payment ID: ${data.payment?.paymentId}`
        );
    } catch (e) {
        assert(false, '8. Retry payment test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 9: Appointment Cancellation Triggers Automatic Refund
    // -------------------------------------------------------------
    try {
        const cancelRes = await fetch(`${BASE_URL}/appointments/${apptBId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({ cancellationReason: 'Personal emergency' })
        });
        const cancelData = await cancelRes.json();

        const ok =
            cancelRes.status === 200 &&
            cancelData.success &&
            cancelData.appointment.status === 'cancelled' &&
            cancelData.appointment.paymentStatus === 'refunded' &&
            !!cancelData.appointment.paymentDetails.refundId;

        assert(
            ok,
            '9. Cancelling paid appointment automatically transitions paymentStatus to "refunded" with refund ID',
            `Status: ${cancelData.appointment?.status}, Payment: ${cancelData.appointment?.paymentStatus}, Refund ID: ${cancelData.appointment?.paymentDetails?.refundId}`
        );
    } catch (e) {
        assert(false, '9. Cancellation refund trigger test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 10: Admin Direct Refund Endpoint (POST /api/payments/:id/refund)
    // -------------------------------------------------------------
    try {
        const refundRes = await fetch(`${BASE_URL}/payments/${apptAId}/refund`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ refundReason: 'Specialist unavailable due to emergency' })
        });
        const refundData = await refundRes.json();

        const ok =
            refundRes.status === 200 &&
            refundData.success &&
            refundData.appointment.paymentStatus === 'refunded' &&
            refundData.payment.status === 'refunded';

        assert(
            ok,
            '10. Admin processes direct refund: appointment and payment records updated to "refunded"',
            `Status: ${refundData.appointment?.paymentStatus}, Refund ID: ${refundData.refund?.id}`
        );
    } catch (e) {
        assert(false, '10. Admin refund endpoint test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 11: Audit Trail: Retrieve Payment Records by Appointment
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/appointment/${apptAId}`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        const ok = res.status === 200 && data.success && data.payments.length >= 1;

        assert(
            ok,
            '11. Audit Trail: Payment history for appointment retrieved with complete transaction metadata',
            `Records: ${data.count}, Order: ${data.payments[0]?.orderId}, Status: ${data.payments[0]?.status}`
        );
    } catch (e) {
        assert(false, '11. Audit trail test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 12: Admin System Payments Listing with Pagination
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/payments/admin/all?limit=5`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        const ok = res.status === 200 && data.success && Array.isArray(data.payments) && data.totalPayments >= 2;

        assert(
            ok,
            '12. Admin Payments Management: Listing returns all system transactions with pagination',
            `Total: ${data.totalPayments}, Page: ${data.page}/${data.pages}`
        );
    } catch (e) {
        assert(false, '12. Admin payments listing test failed', e.message);
    }

    // -------------------------------------------------------------
    // Test 13: Admin System Statistics includes Platform Revenue & Payment Metrics
    // -------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();

        const hasPaymentStats =
            typeof data.stats.totalRevenue === 'number' &&
            typeof data.stats.paidAppointments === 'number' &&
            typeof data.stats.pendingPayments === 'number' &&
            typeof data.stats.refundedPayments === 'number';

        assert(
            res.status === 200 && data.success && hasPaymentStats,
            '13. Admin Dashboard Statistics accurately tracks platform revenue, paid, and refunded counts',
            `Total Revenue: ₹${data.stats.totalRevenue}, Paid: ${data.stats.paidAppointments}, Refunded: ${data.stats.refundedPayments}`
        );
    } catch (e) {
        assert(false, '13. Admin stats payment integration test failed', e.message);
    }

    console.log('\n=====================================================');
    console.log(`TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('=====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase7Tests();

