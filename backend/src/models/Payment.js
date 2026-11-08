import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
    {
        appointment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Appointment',
            required: [true, 'Appointment reference is required']
        },
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Patient reference is required']
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'Doctor reference is required']
        },
        amount: {
            type: Number,
            required: [true, 'Payment amount is required'],
            min: [0, 'Amount cannot be negative']
        },
        currency: {
            type: String,
            default: 'INR',
            trim: true
        },
        orderId: {
            type: String,
            required: [true, 'Razorpay order ID is required'],
            trim: true,
            unique: true
        },
        paymentId: {
            type: String,
            trim: true,
            default: ''
        },
        signature: {
            type: String,
            trim: true,
            default: ''
        },
        status: {
            type: String,
            enum: ['created', 'captured', 'failed', 'refunded'],
            default: 'created'
        },
        method: {
            type: String,
            trim: true,
            default: 'razorpay'
        },
        failureReason: {
            type: String,
            trim: true,
            default: ''
        },
        refundId: {
            type: String,
            trim: true,
            default: ''
        },
        refundReason: {
            type: String,
            trim: true,
            default: ''
        },
        refundedAt: {
            type: Date,
            default: null
        },
        paidAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

paymentSchema.index({ appointment: 1 });
paymentSchema.index({ patient: 1 });
paymentSchema.index({ doctor: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
