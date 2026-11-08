import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import { generateSlotsForDate, getDayOfWeek } from '../utils/slotGenerator.js';

/**
 * @desc    Get available time slots for a doctor on a specific date
 * @route   GET /api/appointments/slots
 * @access  Public (or Authenticated)
 */
export const getAvailableSlots = async (req, res) => {
    try {
        const { doctorId, date } = req.query;

        if (!doctorId || !date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both doctorId and date (YYYY-MM-DD).'
            });
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected YYYY-MM-DD.'
            });
        }

        const doctor = await User.findById(doctorId).select(
            'name role specialization availability isVerified isBlocked fees hospital location'
        );

        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor not found.'
            });
        }

        if (!doctor.isVerified || doctor.isBlocked) {
            return res.status(400).json({
                success: false,
                message: 'Doctor is currently unavailable for appointment scheduling.'
            });
        }

        // Query active booked slots on this date
        const bookedAppointments = await Appointment.find({
            doctor: doctorId,
            date,
            status: { $ne: 'cancelled' }
        }).select('timeSlot');

        const bookedSlots = bookedAppointments.map((a) => a.timeSlot);

        // Generate dynamic slots based on doctor's schedule configuration
        const slotData = generateSlotsForDate(doctor.availability, date, bookedSlots);

        return res.status(200).json({
            success: true,
            doctorId: doctor._id,
            doctorName: doctor.name,
            specialization: doctor.specialization,
            fees: doctor.fees,
            date,
            ...slotData
        });
    } catch (error) {
        console.error('Error in getAvailableSlots:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving doctor appointment slots.',
            error: error.message
        });
    }
};

/**
 * @desc    Book a new consultation appointment
 * @route   POST /api/appointments/book
 * @access  Private (Authenticated Patient)
 */
export const bookAppointment = async (req, res) => {
    try {
        const { doctorId, date, timeSlot, reason, notes } = req.body;
        const patientId = req.user._id;

        // Validation: Presence of required fields
        if (!doctorId || !date || !timeSlot) {
            return res.status(400).json({
                success: false,
                message: 'Please provide doctorId, date, and timeSlot.'
            });
        }

        // Validation: Date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected YYYY-MM-DD.'
            });
        }

        // Validation: Past dates cannot be booked
        const todayUtc = new Date().toISOString().split('T')[0];
        if (date < todayUtc) {
            return res.status(400).json({
                success: false,
                message: 'Appointments cannot be scheduled for past dates.'
            });
        }

        // Check patient account status
        if (req.user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: 'Your account is blocked. You cannot schedule appointments.'
            });
        }

        // Check doctor exists, is verified, and not blocked
        const doctor = await User.findById(doctorId);
        if (!doctor || doctor.role !== 'doctor') {
            return res.status(404).json({
                success: false,
                message: 'Doctor account not found.'
            });
        }

        if (!doctor.isVerified || doctor.isBlocked) {
            return res.status(400).json({
                success: false,
                message: 'This physician is currently not accepting appointment bookings.'
            });
        }

        // Self-appointment prevention
        if (patientId.toString() === doctorId.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Physicians cannot schedule appointments with themselves.'
            });
        }

        // Validate doctor's working days
        const dayOfWeek = getDayOfWeek(date);
        const workingDays = doctor.availability?.workingDays || [
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday'
        ];
        if (!workingDays.includes(dayOfWeek)) {
            return res.status(400).json({
                success: false,
                message: `Dr. ${doctor.name} does not conduct consultations on ${dayOfWeek}s.`
            });
        }

        // Concurrency Guard: Double booking conflict prevention
        const existingSlotBooking = await Appointment.findOne({
            doctor: doctorId,
            date,
            timeSlot: timeSlot.trim(),
            status: { $ne: 'cancelled' }
        });

        if (existingSlotBooking) {
            return res.status(409).json({
                success: false,
                message: 'This consultation time slot has already been booked by another patient. Please select an alternate slot.'
            });
        }

        // Patient duplicate slot check on same date and time
        const patientDuplicate = await Appointment.findOne({
            patient: patientId,
            date,
            timeSlot: timeSlot.trim(),
            status: { $ne: 'cancelled' }
        });

        if (patientDuplicate) {
            return res.status(400).json({
                success: false,
                message: 'You already have an active appointment scheduled for this time slot.'
            });
        }

        // Create new appointment
        const appointment = await Appointment.create({
            patient: patientId,
            doctor: doctorId,
            date,
            timeSlot: timeSlot.trim(),
            reason: (reason && reason.trim()) || 'General Health Consultation',
            notes: (notes && notes.trim()) || '',
            fees: doctor.fees || 0,
            status: 'confirmed'
        });

        // Populate details for response
        const populatedAppointment = await Appointment.findById(appointment._id)
            .populate('patient', 'name email phone bloodGroup')
            .populate('doctor', 'name email specialization hospital location fees');

        return res.status(201).json({
            success: true,
            message: 'Appointment booked and confirmed successfully.',
            appointment: populatedAppointment
        });
    } catch (error) {
        console.error('Error in bookAppointment:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error scheduling appointment.',
            error: error.message
        });
    }
};

/**
 * @desc    Get user's appointments (Patient sees their bookings; Doctor sees their schedule)
 * @route   GET /api/appointments/my
 * @access  Private (Authenticated Patient or Doctor)
 */
export const getMyAppointments = async (req, res) => {
    try {
        const { status, date } = req.query;
        const query = {};

        // Scope strictly by user role
        if (req.user.role === 'patient') {
            query.patient = req.user._id;
        } else if (req.user.role === 'doctor') {
            query.doctor = req.user._id;
        } else if (req.user.role === 'admin') {
            // Admins can view all or optionally filter
        }

        // Optional status filter
        if (status && status !== 'all') {
            query.status = status.toLowerCase().trim();
        }

        // Optional date filter
        if (date && date.trim() !== '') {
            query.date = date.trim();
        }

        const appointments = await Appointment.find(query)
            .populate('patient', 'name email phone bloodGroup')
            .populate('doctor', 'name email specialization hospital location fees')
            .populate('prescription')
            .sort({ date: -1, timeSlot: 1 });

        return res.status(200).json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('Error in getMyAppointments:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving appointments.',
            error: error.message
        });
    }
};

/**
 * @desc    Get appointment by ID
 * @route   GET /api/appointments/:id
 * @access  Private (Patient, Doctor, or Admin)
 */
export const getAppointmentById = async (req, res) => {
    try {
        const { id } = req.params;

        const appointment = await Appointment.findById(id)
            .populate('patient', 'name email phone bloodGroup')
            .populate('doctor', 'name email specialization hospital location fees')
            .populate('prescription');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment record not found.'
            });
        }

        // Access Control: Patient on booking, Doctor on booking, or Admin
        const isPatient = appointment.patient._id.toString() === req.user._id.toString();
        const isDoctor = appointment.doctor._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not authorized to view this appointment.'
            });
        }

        return res.status(200).json({
            success: true,
            appointment
        });
    } catch (error) {
        console.error('Error in getAppointmentById:', error.message);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({
                success: false,
                message: 'Invalid appointment ID.'
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving appointment.',
            error: error.message
        });
    }
};

/**
 * @desc    Cancel an appointment (by Patient, Doctor, or Admin)
 * @route   PUT /api/appointments/:id/cancel
 * @access  Private (Patient, Doctor, or Admin)
 */
export const cancelAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const { cancellationReason } = req.body;

        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment record not found.'
            });
        }

        // Access Control
        const isPatient = appointment.patient.toString() === req.user._id.toString();
        const isDoctor = appointment.doctor.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not authorized to cancel this appointment.'
            });
        }

        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'This appointment is already cancelled.'
            });
        }

        if (appointment.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Completed appointments cannot be cancelled.'
            });
        }

        appointment.status = 'cancelled';
        appointment.cancelledBy = req.user.role;
        appointment.cancellationReason =
            (cancellationReason && cancellationReason.trim()) ||
            `Cancelled by ${req.user.role}.`;

        // If appointment was already paid, automatically mark as refunded
        if (appointment.paymentStatus === 'paid') {
            const refundId = `rfnd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            appointment.paymentStatus = 'refunded';
            appointment.paymentDetails = {
                ...appointment.paymentDetails,
                refundId,
                refundedAt: new Date(),
                refundReason: (cancellationReason && cancellationReason.trim()) || `Appointment cancelled by ${req.user.role}`
            };

            try {
                await Payment.findOneAndUpdate(
                    { appointment: id, status: 'captured' },
                    {
                        status: 'refunded',
                        refundId,
                        refundReason: appointment.paymentDetails.refundReason,
                        refundedAt: new Date()
                    }
                );
            } catch (payErr) {
                console.warn('Payment record refund update note:', payErr.message);
            }
        }

        await appointment.save();

        const updated = await Appointment.findById(id)
            .populate('patient', 'name email phone')
            .populate('doctor', 'name email specialization');

        return res.status(200).json({
            success: true,
            message: 'Appointment cancelled successfully. The time slot is now open for booking.',
            appointment: updated
        });
    } catch (error) {
        console.error('Error in cancelAppointment:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error cancelling appointment.',
            error: error.message
        });
    }
};

/**
 * @desc    Update appointment status (e.g. mark completed by Doctor or Admin)
 * @route   PUT /api/appointments/:id/status
 * @access  Private (Doctor or Admin)
 */
export const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        if (!status || !['confirmed', 'completed', 'cancelled'].includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Valid status required: confirmed, completed, or cancelled.'
            });
        }

        const appointment = await Appointment.findById(id);

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment record not found.'
            });
        }

        // Only the assigned doctor or admin can change status to completed
        const isDoctor = appointment.doctor.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Only the assigned doctor or administrator can update status.'
            });
        }

        appointment.status = status.toLowerCase();
        if (notes !== undefined) {
            appointment.notes = notes.trim();
        }

        await appointment.save();

        const updated = await Appointment.findById(id)
            .populate('patient', 'name email phone')
            .populate('doctor', 'name email specialization');

        return res.status(200).json({
            success: true,
            message: `Appointment status updated to "${appointment.status}".`,
            appointment: updated
        });
    } catch (error) {
        console.error('Error in updateAppointmentStatus:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error updating appointment status.',
            error: error.message
        });
    }
};

/**
 * @desc    Admin listing of all system appointments with search & pagination
 * @route   GET /api/admin/appointments
 * @access  Private (Admin only)
 */
export const getAdminAppointments = async (req, res) => {
    try {
        const { status, date, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status.toLowerCase().trim();
        }

        if (date && date.trim() !== '') {
            query.date = date.trim();
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * pageSize;

        const totalAppointments = await Appointment.countDocuments(query);
        const appointments = await Appointment.find(query)
            .populate('patient', 'name email phone')
            .populate('doctor', 'name email specialization fees')
            .populate('prescription')
            .sort({ date: -1, timeSlot: 1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            success: true,
            count: appointments.length,
            totalAppointments,
            page: pageNum,
            pages: Math.ceil(totalAppointments / pageSize) || 1,
            appointments
        });
    } catch (error) {
        console.error('Error in getAdminAppointments:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving system appointments.',
            error: error.message
        });
    }
};
