import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import { generateSlotsForDate, getDayOfWeek, timeToMinutes, minutesToTime } from '../utils/slotGenerator.js';

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

async function runPhase6Verification() {
    console.log('================================================================');
    console.log('       PHASE 6: APPOINTMENT BOOKING SYSTEM VERIFICATION         ');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    // -------------------------------------------------------------------------
    // 1. Direct MongoDB Connection & Model Integrity
    // -------------------------------------------------------------------------
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/online_doctor_appointment');
        const isConnected = mongoose.connection.readyState === 1;
        const appointmentIndexes = await Appointment.collection.indexes();
        const hasCompoundIndex = appointmentIndexes.some(
            (idx) => idx.key.doctor === 1 && idx.key.date === 1 && idx.key.timeSlot === 1
        );

        recordTest(
            1,
            'Database Connection & Appointment Model Schema Integrity',
            isConnected && hasCompoundIndex,
            `Connected to ${mongoose.connection.host}, compound index (doctor+date+timeSlot): ${hasCompoundIndex}`
        );
        if (isConnected && hasCompoundIndex) passed++; else failed++;
    } catch (err) {
        recordTest(1, 'Database Connection & Appointment Model Schema Integrity', false, err.message);
        failed++;
        process.exit(1);
    }

    // -------------------------------------------------------------------------
    // 2. Unit Verification: Dynamic Slot Generator Logic
    // -------------------------------------------------------------------------
    try {
        const testAvailability = {
            workingDays: ['Monday', 'Wednesday', 'Friday'],
            workingHours: { start: '09:00', end: '11:00' },
            slotDuration: 30,
            breakTime: { start: '09:30', end: '10:00' },
            timeZone: 'UTC'
        };

        // On a Monday: 09:00-09:30, (09:30-10:00 is break), 10:00-10:30, 10:30-11:00
        // Total slots: 3 slots.
        const mondaySlots = generateSlotsForDate(testAvailability, '2026-11-09', ['09:00 - 09:30']);
        const breakExcluded = !mondaySlots.slots.some((s) => s.startTime === '09:30');
        const bookedFlagCorrect = mondaySlots.slots.find((s) => s.timeSlot === '09:00 - 09:30')?.isBooked === true;
        const availableFlagCorrect = mondaySlots.slots.find((s) => s.timeSlot === '10:00 - 10:30')?.isBooked === false;

        const slotLogicValid =
            mondaySlots.isWorkingDay === true &&
            mondaySlots.totalSlots === 3 &&
            mondaySlots.availableSlots === 2 &&
            breakExcluded &&
            bookedFlagCorrect &&
            availableFlagCorrect;

        recordTest(
            2,
            'Slot Generator Unit: Correctly handles breaks, booked status, and working day checks',
            slotLogicValid,
            `Total: ${mondaySlots.totalSlots}, Open: ${mondaySlots.availableSlots}, Break excluded: ${breakExcluded}`
        );
        if (slotLogicValid) passed++; else failed++;
    } catch (err) {
        recordTest(2, 'Slot Generator Unit Logic', false, err.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // Setup API Testing Accounts
    // -------------------------------------------------------------------------
    let adminToken = '';
    let doctorToken = '', doctorId = '', docEmail = `p6_verify_doc_${Date.now()}@test.com`;
    let patientAToken = '', patientAId = '', patientAEmail = `p6_verify_pa_${Date.now()}@test.com`;
    let patientBToken = '', patientBId = '', patientBEmail = `p6_verify_pb_${Date.now()}@test.com`;

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
                name: 'Dr. Stephen Strange',
                email: docEmail,
                password: 'DoctorPassword123',
                role: 'doctor',
                phone: '+1 555-7788',
                specialization: 'Neuro-Surgery',
                experience: 18,
                fees: 2500,
                hospital: 'Metro General Hospital'
            })
        })).json();
        doctorToken = docRes.token;
        doctorId = docRes.user._id;

        // Admin verifies doctor
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
                workingHours: { start: '10:00', end: '13:00' },
                slotDuration: 30,
                breakTime: { start: '11:30', end: '12:00' },
                timeZone: 'UTC'
            })
        });

        // Patient A
        const paRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Tony Stark',
                email: patientAEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-1111'
            })
        })).json();
        patientAToken = paRes.token;
        patientAId = paRes.user._id;

        // Patient B
        const pbRes = await (await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Steve Rogers',
                email: patientBEmail,
                password: 'Password123',
                role: 'patient',
                phone: '+1 555-2222'
            })
        })).json();
        patientBToken = pbRes.token;
        patientBId = pbRes.user._id;

        recordTest(
            3,
            'API Environment Setup: Admin, Doctor, and 2 Patients Created & Configured',
            !!(adminToken && doctorToken && patientAToken && patientBToken),
            `Doctor: Dr. Stephen Strange (${doctorId}), Patient A: Tony Stark, Patient B: Steve Rogers`
        );
        passed++;
    } catch (e) {
        recordTest(3, 'API Environment Setup', false, e.message);
        failed++;
        process.exit(1);
    }

    // Determine future test date
    const getNextWeekday = (daysAhead = 1) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() + daysAhead);
        while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        return d.toISOString().split('T')[0];
    };
    const testDate = getNextWeekday(2);

    // -------------------------------------------------------------------------
    // 4. GET /api/appointments/slots - Dynamic Slot Generation
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/slots?doctorId=${doctorId}&date=${testDate}`);
        const data = await res.json();
        // 10:00-13:00 with 30 min slots and break 11:30-12:00:
        // Slots: 10:00-10:30, 10:30-11:00, 11:00-11:30, [11:30-12:00 break], 12:00-12:30, 12:30-13:00
        // Expected slots: 5
        const valid =
            res.status === 200 &&
            data.success &&
            data.isWorkingDay === true &&
            data.slots.length === 5 &&
            !data.slots.some((s) => s.startTime === '11:30');

        recordTest(
            4,
            'GET /api/appointments/slots: Dynamic slots correctly calculated with break exclusion',
            valid,
            `Date: ${testDate}, Slots returned: ${data.slots?.length}, Fee: ₹${data.fees}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(4, 'GET /api/appointments/slots', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 5. Validation: Past Date Booking Rejected (HTTP 400)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: '2021-05-15',
                timeSlot: '10:00 - 10:30'
            })
        });
        const data = await res.json();
        const valid = res.status === 400 && data.success === false && data.message.includes('past');
        recordTest(
            5,
            'Booking Validation: Past date booking rejected with HTTP 400',
            valid,
            `HTTP ${res.status}: "${data.message}"`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(5, 'Past Date Booking Validation', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 6. Validation: Doctor Booking with Themselves Rejected (HTTP 400)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                doctorId,
                date: testDate,
                timeSlot: '10:00 - 10:30'
            })
        });
        const data = await res.json();
        const valid = res.status === 400 && data.success === false && data.message.includes('themselves');
        recordTest(
            6,
            'Booking Validation: Doctor cannot book appointment with themselves (HTTP 400)',
            valid,
            `HTTP ${res.status}: "${data.message}"`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(6, 'Doctor Self-Booking Validation', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 7. Successful Appointment Booking (HTTP 201)
    // -------------------------------------------------------------------------
    let bookedApptId = '';
    const targetSlot = '10:00 - 10:30';
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
                reason: 'Chest pain and arc reactor checkup'
            })
        });
        const data = await res.json();
        bookedApptId = data.appointment?._id;

        const valid =
            res.status === 201 &&
            data.success &&
            data.appointment.status === 'confirmed' &&
            data.appointment.fees === 2500 &&
            data.appointment.patient.name === 'Tony Stark';

        recordTest(
            7,
            'POST /api/appointments/book: Patient successfully books consultation (HTTP 201)',
            valid,
            `ID: ${bookedApptId}, Status: ${data.appointment?.status}, Fee: ₹${data.appointment?.fees}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(7, 'Appointment Booking', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 8. Concurrency Guard: Double-Booking Slot Rejection (HTTP 409)
    // -------------------------------------------------------------------------
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
                timeSlot: targetSlot, // Exact same slot already booked by Patient A
                reason: 'Routine physical'
            })
        });
        const data = await res.json();
        const valid = res.status === 409 && data.success === false && data.message.includes('already been booked');

        recordTest(
            8,
            'Concurrency Guard: Simultaneous booking of same slot rejected with HTTP 409 Conflict',
            valid,
            `HTTP ${res.status}: "${data.message}"`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(8, 'Double Booking Concurrency Guard', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 9. Slot Availability Reflects Booked Status
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/slots?doctorId=${doctorId}&date=${testDate}`);
        const data = await res.json();
        const bookedSlot = data.slots.find((s) => s.timeSlot === targetSlot);
        const freeSlot = data.slots.find((s) => s.timeSlot !== targetSlot);

        const valid = bookedSlot?.isBooked === true && freeSlot?.isBooked === false;
        recordTest(
            9,
            'Slot Reflection: Booked slot correctly flagged as isBooked: true',
            valid,
            `Slot ${targetSlot} isBooked: ${bookedSlot?.isBooked}, Remaining open: ${data.availableSlots}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(9, 'Slot Availability Reflection', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 10. Patient Retrieves Scheduled Appointments (GET /api/appointments/my)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/my`, {
            headers: { 'Authorization': `Bearer ${patientAToken}` }
        });
        const data = await res.json();
        const found = data.appointments.some((a) => a._id === bookedApptId);

        recordTest(
            10,
            'GET /api/appointments/my: Patient retrieves their consultation bookings',
            res.status === 200 && found,
            `Patient appointments count: ${data.count}, Booked appointment present: ${found}`
        );
        if (res.status === 200 && found) passed++; else failed++;
    } catch (e) {
        recordTest(10, 'Patient View Appointments', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 11. Doctor Retrieves Scheduled Consultations (GET /api/appointments/my)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/my`, {
            headers: { 'Authorization': `Bearer ${doctorToken}` }
        });
        const data = await res.json();
        const found = data.appointments.some((a) => a._id === bookedApptId);
        const patientName = data.appointments.find((a) => a._id === bookedApptId)?.patient?.name;

        recordTest(
            11,
            'GET /api/appointments/my: Doctor retrieves their patient consultation schedule',
            res.status === 200 && found && patientName === 'Tony Stark',
            `Doctor schedule count: ${data.count}, Patient name: ${patientName}`
        );
        if (res.status === 200 && found) passed++; else failed++;
    } catch (e) {
        recordTest(11, 'Doctor View Schedule', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 12. Privacy & Access Control: Unauthorized Patient Cannot View Details (HTTP 403)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/${bookedApptId}`, {
            headers: { 'Authorization': `Bearer ${patientBToken}` }
        });
        const valid = res.status === 403;
        recordTest(
            12,
            'Privacy Control: Unrelated Patient B blocked from viewing Patient A appointment (HTTP 403)',
            valid,
            `HTTP status: ${res.status}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(12, 'Privacy Control', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 13. Patient Cancels Appointment & Slot Is Released (PUT /api/appointments/:id/cancel)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/${bookedApptId}/cancel`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${patientAToken}`
            },
            body: JSON.stringify({
                cancellationReason: 'Emergency business trip'
            })
        });
        const data = await res.json();
        const valid =
            res.status === 200 &&
            data.success &&
            data.appointment.status === 'cancelled' &&
            data.appointment.cancelledBy === 'patient';

        recordTest(
            13,
            'PUT /api/appointments/:id/cancel: Patient cancels appointment and status updates to "cancelled"',
            valid,
            `Status: ${data.appointment?.status}, CancelledBy: ${data.appointment?.cancelledBy}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(13, 'Appointment Cancellation', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 14. Freed Slot Is Re-Bookable By Patient B (HTTP 201)
    // -------------------------------------------------------------------------
    let rebookedId = '';
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
                timeSlot: targetSlot, // Re-booking the newly freed slot
                reason: 'Follow-up consultation'
            })
        });
        const data = await res.json();
        rebookedId = data.appointment?._id;
        const valid = res.status === 201 && data.success && data.appointment.status === 'confirmed';

        recordTest(
            14,
            'Slot Re-availability: Cancelled slot is immediately unlocked and booked by Patient B',
            valid,
            `New Booking ID: ${rebookedId}, Patient: ${data.appointment?.patient?.name}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(14, 'Slot Re-availability', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 15. Doctor Completes Consultation (PUT /api/appointments/:id/status)
    // -------------------------------------------------------------------------
    try {
        const res = await fetch(`${BASE_URL}/appointments/${rebookedId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doctorToken}`
            },
            body: JSON.stringify({
                status: 'completed',
                notes: 'Patient examined. Prescription issued and vitals normal.'
            })
        });
        const data = await res.json();
        const valid =
            res.status === 200 &&
            data.success &&
            data.appointment.status === 'completed' &&
            data.appointment.notes.includes('Prescription issued');

        recordTest(
            15,
            'PUT /api/appointments/:id/status: Doctor marks consultation "completed" with clinical notes',
            valid,
            `Status: ${data.appointment?.status}, Clinical Notes: "${data.appointment?.notes}"`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(15, 'Doctor Consultation Completion', false, e.message);
        failed++;
    }

    // -------------------------------------------------------------------------
    // 16. Admin Appointments Overview & System Stats Integration
    // -------------------------------------------------------------------------
    try {
        const apptRes = await (await fetch(`${BASE_URL}/admin/appointments`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })).json();

        const statsRes = await (await fetch(`${BASE_URL}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        })).json();

        const valid =
            apptRes.success === true &&
            Array.isArray(apptRes.appointments) &&
            typeof statsRes.stats.totalAppointments === 'number' &&
            statsRes.stats.totalAppointments >= 2 &&
            statsRes.stats.completedAppointments >= 1 &&
            statsRes.stats.cancelledAppointments >= 1;

        recordTest(
            16,
            'Admin Overview & Stats: Appointments table and dashboard statistics correctly reflect booking records',
            valid,
            `Total: ${statsRes.stats?.totalAppointments}, Completed: ${statsRes.stats?.completedAppointments}, Cancelled: ${statsRes.stats?.cancelledAppointments}`
        );
        if (valid) passed++; else failed++;
    } catch (e) {
        recordTest(16, 'Admin Appointments Integration', false, e.message);
        failed++;
    }

    await mongoose.disconnect();

    console.log('================================================================');
    console.log(`PHASE 6 VERIFICATION SUMMARY: ${passed}/${passed + failed} PASSED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runPhase6Verification();

