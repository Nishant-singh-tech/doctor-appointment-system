import Appointment from '../models/Appointment.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import {
    createRazorpayOrder,
    verifyRazorpaySignature,
    generateTestSignature,
    issueRazorpayRefund,
    key_id
} from '../config/razorpay.js';

/**
 * @desc    Create Razorpay payment order for an appointment
 * @route   POST /api/payments/create-order
 * @access  Private (Patient on booking or Admin)
 */
export const createPaymentOrder = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid appointmentId.'
            });
        }

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name email fees specialization')
            .populate('patient', 'name email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        // Access Control: Only the patient who booked or an admin can initialize payment
        const isPatientOwner = appointment.patient._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatientOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only make payments for your own appointments.'
            });
        }

        // Prevent payment on cancelled appointments
        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot process payment for a cancelled appointment.'
            });
        }

        // Duplicate payment prevention
        if (appointment.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This appointment has already been paid for. Duplicate payment prevented.'
            });
        }

        const amount = appointment.fees || 0;
        if (amount <= 0) {
            // Free consultation handling
            appointment.paymentStatus = 'paid';
            appointment.paymentDetails = {
                ...appointment.paymentDetails,
                paidAt: new Date(),
                razorpayOrderId: 'free_consultation',
                razorpayPaymentId: 'pay_free_0'
            };
            await appointment.save();

            return res.status(200).json({
                success: true,
                message: 'Consultation fee is ₹0. Marked as paid without payment gateway.',
                isFree: true,
                appointment
            });
        }

        // Check if an existing uncaptured payment order exists, or create a new Razorpay order
        const order = await createRazorpayOrder({
            amount,
            currency: 'INR',
            receipt: `rcpt_appt_${appointment._id.toString().slice(-8)}`,
            notes: {
                appointmentId: appointment._id.toString(),
                doctorName: appointment.doctor.name,
                patientName: appointment.patient.name,
                patientEmail: appointment.patient.email
            }
        });

        // Record payment transaction in database
        const paymentRecord = await Payment.create({
            appointment: appointment._id,
            patient: appointment.patient._id,
            doctor: appointment.doctor._id,
            amount,
            currency: order.currency,
            orderId: order.id,
            status: 'created',
            method: 'razorpay'
        });

        // Store orderId on appointment
        appointment.paymentDetails.razorpayOrderId = order.id;
        await appointment.save();

        return res.status(200).json({
            success: true,
            orderId: order.id,
            amount: order.amount, // in paise
            amountInRupees: amount,
            currency: order.currency,
            keyId: key_id,
            appointment: {
                _id: appointment._id,
                doctor: appointment.doctor,
                patient: appointment.patient,
                date: appointment.date,
                timeSlot: appointment.timeSlot,
                fees: appointment.fees
            },
            paymentId: paymentRecord._id
        });
    } catch (error) {
        console.error('Error creating payment order:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error generating payment order.',
            error: error.message
        });
    }
};

/**
 * @desc    Verify Razorpay payment signature securely on the server
 * @route   POST /api/payments/verify
 * @access  Private (Patient or Admin)
 */
export const verifyPayment = async (req, res) => {
    try {
        const appointmentId = req.body.appointmentId;
        const razorpay_order_id = req.body.razorpay_order_id || req.body.razorpayOrderId;
        const razorpay_payment_id = req.body.razorpay_payment_id || req.body.razorpayPaymentId;
        const razorpay_signature = req.body.razorpay_signature || req.body.razorpaySignature;

        if (!appointmentId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: 'Missing required payment verification parameters (appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature).'
            });
        }

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name email fees specialization')
            .populate('patient', 'name email phone');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        // Access Control
        const isPatientOwner = appointment.patient._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatientOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not authorized to verify this payment.'
            });
        }

        // Prevent duplicate payment capture
        if (appointment.paymentStatus === 'paid') {
            return res.status(400).json({
                success: false,
                message: 'This appointment has already been paid for. Duplicate payment prevented.'
            });
        }

        // CRITICAL SECURITY RULE: Validate server-side cryptographic HMAC-SHA256 signature
        const isSignatureValid = verifyRazorpaySignature({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature
        });

        const payment = await Payment.findOne({ orderId: razorpay_order_id });

        if (!isSignatureValid) {
            // Log security failure
            if (payment) {
                payment.status = 'failed';
                payment.failureReason = 'Cryptographic signature verification failed (Tampered or invalid signature)';
                await payment.save();
            }

            appointment.paymentStatus = 'failed';
            appointment.paymentDetails.failureReason = 'Cryptographic signature mismatch';
            await appointment.save();

            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature. Payment verification failed. Never trust unverified client confirmations.'
            });
        }

        // Signature is authentic and verified
        const now = new Date();

        if (payment) {
            payment.status = 'captured';
            payment.paymentId = razorpay_payment_id;
            payment.signature = razorpay_signature;
            payment.paidAt = now;
            await payment.save();
        }

        appointment.paymentStatus = 'paid';
        appointment.paymentDetails = {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            paidAt: now,
            failureReason: ''
        };
        await appointment.save();

        return res.status(200).json({
            success: true,
            message: 'Payment verified and captured successfully.',
            appointment,
            payment
        });
    } catch (error) {
        console.error('Error verifying payment:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error verifying payment.',
            error: error.message
        });
    }
};

/**
 * @desc    Record client-side payment dismissal or gateway failure
 * @route   POST /api/payments/fail
 * @access  Private (Patient or Admin)
 */
export const handlePaymentFailure = async (req, res) => {
    try {
        const { appointmentId, orderId, failureReason } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'Appointment ID is required.'
            });
        }

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        // Only mark failed if not already paid
        if (appointment.paymentStatus !== 'paid') {
            appointment.paymentStatus = 'failed';
            appointment.paymentDetails.failureReason = failureReason || 'Payment failed or cancelled by user';
            await appointment.save();
        }

        if (orderId) {
            const payment = await Payment.findOne({ orderId });
            if (payment && payment.status !== 'captured') {
                payment.status = 'failed';
                payment.failureReason = failureReason || 'Payment cancelled by user or gateway';
                await payment.save();
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Payment failure recorded.',
            appointment
        });
    } catch (error) {
        console.error('Error handling payment failure:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error recording payment failure.',
            error: error.message
        });
    }
};

/**
 * @desc    Process refund for a paid appointment
 * @route   POST /api/payments/:appointmentId/refund
 * @access  Private (Admin, Doctor, or Patient upon cancellation)
 */
export const refundPayment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { refundReason } = req.body;

        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name email')
            .populate('patient', 'name email');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        // Access Control: Patient, Doctor, or Admin
        const isPatient = appointment.patient._id.toString() === req.user._id.toString();
        const isDoctor = appointment.doctor._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You cannot request a refund for this appointment.'
            });
        }

        if (appointment.paymentStatus !== 'paid') {
            return res.status(400).json({
                success: false,
                message: `Cannot refund appointment with payment status "${appointment.paymentStatus}". Only paid appointments can be refunded.`
            });
        }

        // Issue refund
        const refund = await issueRazorpayRefund({
            paymentId: appointment.paymentDetails.razorpayPaymentId,
            amount: appointment.fees,
            notes: {
                appointmentId: appointment._id.toString(),
                reason: refundReason || `Refund initiated by ${req.user.role}`
            }
        });

        const now = new Date();

        // Update Payment record
        const payment = await Payment.findOne({
            appointment: appointment._id,
            status: 'captured'
        });

        if (payment) {
            payment.status = 'refunded';
            payment.refundId = refund.id;
            payment.refundReason = refundReason || `Refund initiated by ${req.user.role}`;
            payment.refundedAt = now;
            await payment.save();
        }

        // Update Appointment record
        appointment.paymentStatus = 'refunded';
        appointment.paymentDetails.refundId = refund.id;
        appointment.paymentDetails.refundReason = refundReason || `Refund initiated by ${req.user.role}`;
        appointment.paymentDetails.refundedAt = now;
        await appointment.save();

        return res.status(200).json({
            success: true,
            message: 'Payment refunded successfully.',
            refund,
            appointment,
            payment
        });
    } catch (error) {
        console.error('Error processing refund:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error processing refund.',
            error: error.message
        });
    }
};

/**
 * @desc    Get payment audit records for an appointment
 * @route   GET /api/payments/appointment/:appointmentId
 * @access  Private (Patient, Doctor, or Admin)
 */
export const getPaymentByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        const isPatient = appointment.patient.toString() === req.user._id.toString();
        const isDoctor = appointment.doctor.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You cannot view payment details for this appointment.'
            });
        }

        const payments = await Payment.find({ appointment: appointmentId })
            .populate('patient', 'name email phone')
            .populate('doctor', 'name email specialization')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: payments.length,
            payments,
            paymentStatus: appointment.paymentStatus,
            paymentDetails: appointment.paymentDetails
        });
    } catch (error) {
        console.error('Error fetching appointment payments:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving payment details.',
            error: error.message
        });
    }
};

/**
 * @desc    Admin listing of all system payments with pagination and filter
 * @route   GET /api/payments/admin/all
 * @access  Private (Admin only)
 */
export const getAdminPayments = async (req, res) => {
    try {
        const { status, page = 1, limit = 10, search } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status.toLowerCase().trim();
        }

        if (search && search.trim() !== '') {
            const regex = { $regex: search.trim(), $options: 'i' };
            query.$or = [
                { orderId: regex },
                { paymentId: regex },
                { refundId: regex }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * pageSize;

        const totalPayments = await Payment.countDocuments(query);
        const payments = await Payment.find(query)
            .populate('patient', 'name email phone')
            .populate('doctor', 'name email specialization')
            .populate('appointment', 'date timeSlot status fees')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            success: true,
            count: payments.length,
            totalPayments,
            page: pageNum,
            pages: Math.ceil(totalPayments / pageSize) || 1,
            payments
        });
    } catch (error) {
        console.error('Error in getAdminPayments:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving payments.',
            error: error.message
        });
    }
};

/**
 * @desc    Simulate Razorpay payment gateway callback for test mode / development
 * @route   POST /api/payments/simulate-gateway-callback
 * @access  Private (Development/Test mode only)
 */
export const simulateGatewayCallback = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'orderId is required to generate test gateway callback.'
            });
        }

        const paymentId = `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const signature = generateTestSignature({ orderId, paymentId });

        return res.status(200).json({
            success: true,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
