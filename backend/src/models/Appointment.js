import mongoose from 'mongoose';

const appointmentSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Patient ID is required']
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Doctor ID is required']
        },
        date: {
            type: String,
            required: [true, 'Appointment date is required (YYYY-MM-DD)'],
            match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format']
        },
        timeSlot: {
            type: String,
            required: [true, 'Time slot is required (e.g. 09:00 - 09:30)'],
            trim: true
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'completed', 'cancelled'],
            default: 'confirmed'
        },
        reason: {
            type: String,
            trim: true,
            maxLength: [500, 'Reason cannot exceed 500 characters'],
            default: 'General Consultation'
        },
        notes: {
            type: String,
            trim: true,
            default: ''
        },
        fees: {
            type: Number,
            default: 0
        },
        cancelledBy: {
            type: String,
            enum: ['patient', 'doctor', 'admin', null],
            default: null
        },
        cancellationReason: {
            type: String,
            trim: true,
            default: ''
        },
        // Phase 7: Online Payment Integration
        paymentStatus: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        },
        paymentDetails: {
            razorpayOrderId: { type: String, trim: true, default: '' },
            razorpayPaymentId: { type: String, trim: true, default: '' },
            razorpaySignature: { type: String, trim: true, default: '' },
            paidAt: { type: Date, default: null },
            refundId: { type: String, trim: true, default: '' },
            refundedAt: { type: Date, default: null },
            refundReason: { type: String, trim: true, default: '' },
            failureReason: { type: String, trim: true, default: '' }
        },
        // Phase 8: Prescription Management
        prescription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Prescription',
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Compound index to quickly find conflicts: doctor + date + timeSlot
// Note: We enforce unique slot bookings in application logic for non-cancelled appointments,
// and index for performant queries.
appointmentSchema.index({ doctor: 1, date: 1, timeSlot: 1 });
appointmentSchema.index({ patient: 1, date: 1 });

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
