import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { getDayOfWeek } from '../utils/slotGenerator.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';

async function runPhase6Tests() {
    console.log('=====================================================');
    console.log('       STARTING PHASE 6 BACKEND API TEST SUITE       ');
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

    // Setup: Admin Login
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

    // Setup: Create verified Doctor with custom availability
    let doctorToken = '';
    let doctorId = '';
    const docEmail = `p6_doc_${Date.now()}@test.com`;

    try {
        const docRegRes = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Dr. Bruce Banner',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+1 555-1122',
                specialization: 'Biophysics & Endocrinology',
                experience: 16,
                fees: 1500
            })
        });
        const docRegData = await docRegRes.json();
        doctorToken = docRegData.token;
        doctorId = docRegData.user._id;

        // Admin approves doctor
        await fetch(`${BASE_URL}/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ status: 'approved' })
        });

        // Doctor sets availability: Mon, Tue, Wed, Thu, Fri (09:00 - 12:00, 30 min slots, break 10:30 - 11:00)
        await fetch(`${BASE_URL}/doctors/availability/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                workingHours: { start: '09:00', end: '12:00' },
                slotDuration: 30,
                breakTime: { start: '10:30', end: '11:00' },
                timeZone: 'UTC'
            })
        });

        assert(!!doctorId, 'Setup: Created and verified Dr. Bruce Banner with configured schedule');
    } catch (e) {
        assert(false, 'Setup: Doctor setup failed', e.message);
        process.exit(1);
    }

    // Setup: Create 2 Test Patients
    let patientAToken = '';
    let patientAId = '';
    const patientAEmail = `p6_patient_a_${Date.now()}@test.com`;

    let patientBToken = '';
    let patientBId = '';
    const patientBEmail = `p6_patient_b_${Date.now()}@test.com`;

    try {
        const resA = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Peter Parker',
                email: patientAEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-3344'
            })
        });
        const dataA = await resA.json();
        patientAToken = dataA.token;
        patientAId = dataA.user._id;

        const resB = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Miles Morales',
                email: patientBEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-4455'
            })
        });
        const dataB = await resB.json();
        patientBToken = dataB.token;
        patientBId = dataB.user._id;

        assert(!!patientAToken && !!patientBToken, 'Setup: Created Patient A and Patient B');
    } catch (e) {
        assert(false, 'Setup: Patient registration failed', e.message);
        process.exit(1);
    }

    // Determine upcoming weekdays for testing
    const getUpcomingWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };

    const getUpcomingSunday = () => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + 1);
        while (d.getUTCDay() !== 0) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };

    const testDate = getUpcomingWeekday(2);
    const nonWorkingDate = getUpcomingSunday();

    // 1. Dynamic Slot Generation (GET /api/appointments/slots)
    let availableSlotsList = [];
    try {
        const res = await fetch(`${BASE_URL}/appointments/slots?doctorId=${doctorId}&date=${testDate}`);
        const data = await res.json();
        availableSlotsList = data.slots || [];

        // Expected slots: 09:00-09:30, 09:30-10:00, 10:00-10:30, [10:30-11:00 is break!], 11:00-11:30, 11:30-12:00
        // Total slots: 5 (break slot 10:30-11:00 is excluded)
        const breakExcluded = !data.slots.some((s) => s.startTime === '10:30');
        const allUnbooked = data.slots.every((s) => s.isBooked === false);

        assert(
            res.status === 200 && data.success && data.isWorkingDay === true && breakExcluded && allUnbooked && data.slots.length === 5,
            '1. Dynamic slot generation accurately excludes break time and returns open slots',
            `Date: ${testDate} (${data.dayOfWeek}), Total Slots: ${data.totalSlots}, Break excluded: ${breakExcluded}, Open: ${allUnbooked}`
        );
    } catch (e) {
        assert(false, '1. Slot generation failed', e.message);
    }

    // 2. Non-working day slot generation
    try {
        const res = await fetch(`${BASE_URL}/appointments/slots?doctorId=${doctorId}&date=${nonWorkingDate}`);
        const data = await res.json();
        assert(
            res.status === 200 && data.isWorkingDay === false && data.slots.length === 0,
            '2. Non-working day correctly returns 0 slots with isWorkingDay: false',
            `Date: ${nonWorkingDate} (${data.dayOfWeek}), Message: "${data.message}"`
        );
    } catch (e) {
        assert(false, '2. Non-working day test failed', e.message);
    }

    // 3. Validation: Past date booking rejection
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: '2020-01-01',
                timeSlot: '09:00 - 09:30'
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.success === false && data.message.includes('past'),
            '3. Validation rejects attempts to book appointments in the past (HTTP 400)',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '3. Past date booking test failed', e.message);
    }

    // 4. Validation: Doctor booking appointment with themselves
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                doctorId, // Same as authenticated doctor!
                date: testDate,
                timeSlot: '09:00 - 09:30'
            })
        });
        const data = await res.json();
        assert(
            res.status === 400 && data.success === false && data.message.includes('themselves'),
            '4. Validation rejects doctor self-appointment booking (HTTP 400)',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '4. Self-booking test failed', e.message);
    }

    // 5. Successful Appointment Booking (Patient A books 09:00 - 09:30)
    let bookedAppointmentId = '';
    const targetSlot = '09:00 - 09:30';
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
                timeSlot: targetSlot,
                reason: 'Persistent headaches and routine bloodwork follow-up'
            })
        });
        const data = await res.json();
        bookedAppointmentId = data.appointment?._id;

        const bookingSuccess =
            res.status === 201 &&
            data.success &&
            data.appointment.status === 'confirmed' &&
            data.appointment.patient.name === 'Peter Parker' &&
            data.appointment.doctor.name === 'Dr. Bruce Banner' &&
            data.appointment.fees === 1500;

        assert(
            bookingSuccess,
            '5. Patient A successfully schedules appointment with Dr. Bruce Banner (HTTP 201)',
            `Status: ${data.appointment?.status}, Fee: ₹${data.appointment?.fees}, Patient: ${data.appointment?.patient?.name}`
        );
    } catch (e) {
        assert(false, '5. Booking test failed', e.message);
    }

    // 6. Concurrency & Conflict Guard: Patient B tries to book the SAME slot (Double-Booking Prevention)
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: targetSlot, // Conflict! Already booked by Patient A
                reason: 'Checkup'
            })
        });
        const data = await res.json();
        assert(
            res.status === 409 && data.success === false && data.message.includes('already been booked'),
            '6. Concurrency Guard: Double booking the same slot returns HTTP 409 Conflict',
            `HTTP ${res.status}: "${data.message}"`
        );
    } catch (e) {
        assert(false, '6. Double-booking conflict test failed', e.message);
    }

    // 7. Dynamic Slots reflects the booked status (Slot shows isBooked: true)
    try {
        const res = await fetch(`${BASE_URL}/appointments/slots?doctorId=${doctorId}&date=${testDate}`);
        const data = await res.json();
        const bookedSlotObj = data.slots.find((s) => s.timeSlot === targetSlot);
        const otherSlotObj = data.slots.find((s) => s.timeSlot !== targetSlot);

        assert(
            res.status === 200 && bookedSlotObj.isBooked === true && otherSlotObj.isBooked === false,
            '7. Slot query reflects real-time booking status (09:00 slot isBooked: true, others: false)',
            `Target slot isBooked: ${bookedSlotObj?.isBooked}, Other slot isBooked: ${otherSlotObj?.isBooked}`
        );
    } catch (e) {
        assert(false, '7. Slot availability reflection failed', e.message);
    }

    // 8. Patient can view their own booked appointments (GET /api/appointments/my)
    try {
        const res = await fetch(`${BASE_URL}/appointments/my`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        const found = data.appointments.some((a) => a._id === bookedAppointmentId);
        assert(
            res.status === 200 && data.success && found,
            '8. Patient can retrieve their consultation appointments via GET /api/appointments/my',
            `Count: ${data.count}, Appointment ID found: ${found}`
        );
    } catch (e) {
        assert(false, '8. Patient view appointments failed', e.message);
    }

    // 9. Doctor can view their incoming patient schedule (GET /api/appointments/my)
    try {
        const res = await fetch(`${BASE_URL}/appointments/my`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const data = await res.json();
        const found = data.appointments.some((a) => a._id === bookedAppointmentId);
        assert(
            res.status === 200 && data.success && found && data.appointments[0].patient.name === 'Peter Parker',
            '9. Doctor can view their scheduled patient consultations with patient details',
            `Doctor schedule count: ${data.count}, Patient: ${data.appointments[0]?.patient?.name}`
        );
    } catch (e) {
        assert(false, '9. Doctor view schedule failed', e.message);
    }

    // 10. Privacy & Role Isolation: Unrelated Patient B cannot view Patient A's appointment details
    try {
        const res = await fetch(`${BASE_URL}/appointments/${bookedAppointmentId}`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        assert(
            res.status === 403,
            '10. Privacy & Access Control: Patient B cannot view Patient A\'s appointment (HTTP 403)',
            `HTTP ${res.status}`
        );
    } catch (e) {
        assert(false, '10. Privacy isolation test failed', e.message);
    }

    // 11. Patient Cancels Appointment (PUT /api/appointments/:id/cancel)
    try {
        const res = await fetch(`${BASE_URL}/appointments/${bookedAppointmentId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                cancellationReason: 'Work schedule conflict, need to reschedule.'
            })
        });
        const data = await res.json();
        const cancelled =
            res.status === 200 &&
            data.success &&
            data.appointment.status === 'cancelled' &&
            data.appointment.cancelledBy === 'patient';

        assert(
            cancelled,
            '11. Patient successfully cancels appointment; status updated to "cancelled"',
            `Status: ${data.appointment?.status}, CancelledBy: ${data.appointment?.cancelledBy}`
        );
    } catch (e) {
        assert(false, '11. Patient cancellation failed', e.message);
    }

    // 12. Slot Re-availability: After cancellation, Patient B CAN now book the freed slot!
    let patientBBookingId = '';
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientBToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: targetSlot, // Re-booking the freed slot!
                reason: 'Urgent consultation'
            })
        });
        const data = await res.json();
        patientBBookingId = data.appointment?._id;

        assert(
            res.status === 201 && data.success && data.appointment.status === 'confirmed',
            '12. Slot is immediately unlocked after cancellation and can be booked by Patient B',
            `Status: ${data.appointment?.status}, New Patient: ${data.appointment?.patient?.name}`
        );
    } catch (e) {
        assert(false, '12. Slot re-availability test failed', e.message);
    }

    // 13. Doctor completes appointment (PUT /api/appointments/:id/status)
    try {
        const res = await fetch(`${BASE_URL}/appointments/${patientBBookingId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                status: 'completed',
                notes: 'Patient examined. Follow-up consultation in 2 weeks.'
            })
        });
        const data = await res.json();
        assert(
            res.status === 200 && data.success && data.appointment.status === 'completed',
            '13. Doctor successfully marks consultation appointment as "completed"',
            `Status: ${data.appointment?.status}, Doctor notes: "${data.appointment?.notes}"`
        );
    } catch (e) {
        assert(false, '13. Doctor mark completed test failed', e.message);
    }

    // 14. Admin Appointments List & Statistics Integration
    try {
        // Admin gets all system appointments
        const apptRes = await fetch(`${BASE_URL}/admin/appointments`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const apptData = await apptRes.json();

        // Admin checks stats
        const statsRes = await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const statsData = await statsRes.json();

        const hasRealApptStats =
            typeof statsData.stats.totalAppointments === 'number' &&
            typeof statsData.stats.completedAppointments === 'number' &&
            typeof statsData.stats.cancelledAppointments === 'number' &&
            statsData.stats.totalAppointments >= 2;

        assert(
            apptRes.status === 200 && apptData.success && hasRealApptStats,
            '14. Admin appointment overview and system stats accurately reflect real appointment records',
            `Total Appointments: ${statsData.stats.totalAppointments}, Completed: ${statsData.stats.completedAppointments}, Cancelled: ${statsData.stats.cancelledAppointments}`
        );
    } catch (e) {
        assert(false, '14. Admin appointments and stats test failed', e.message);
    }

    console.log('\n=====================================================');
    console.log(`TEST SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('=====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase6Tests();
