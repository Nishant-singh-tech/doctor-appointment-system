import Prescription from '../models/Prescription.js';
import Appointment from '../models/Appointment.js';
import User from '../models/User.js';
import { generatePrescriptionPDF } from '../utils/pdfGenerator.js';

/**
 * @desc    Create a new digital prescription for an appointment
 * @route   POST /api/prescriptions
 * @access  Private (Doctor only)
 */
export const createPrescription = async (req, res) => {
    try {
        const { appointmentId, diagnosis, symptoms, medicines, advice, followUpDate } = req.body;

        // Validation 1: Required fields
        if (!appointmentId || !diagnosis) {
            return res.status(400).json({
                success: false,
                message: 'Appointment ID and clinical diagnosis are required.'
            });
        }

        // Validation 2: Medicines list validation
        if (!Array.isArray(medicines) || medicines.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Prescription must contain at least one prescribed medicine.'
            });
        }

        for (let i = 0; i < medicines.length; i++) {
            const med = medicines[i];
            if (!med.name || !med.dosage || !med.frequency || !med.duration) {
                return res.status(400).json({
                    success: false,
                    message: `Medicine #${i + 1} is missing required details (name, dosage, frequency, or duration).`
                });
            }
        }

        // Validation 3: Find Appointment
        const appointment = await Appointment.findById(appointmentId)
            .populate('doctor', 'name email specialization qualifications hospital location')
            .populate('patient', 'name email phone gender dateOfBirth bloodGroup');

        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment record not found.'
            });
        }

        // Validation 4: Doctor ownership verification
        if (appointment.doctor._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only create prescriptions for your own assigned appointments.'
            });
        }

        // Validation 5: Appointment status check (cannot prescribe for cancelled appointments)
        if (appointment.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Cannot generate a prescription for a cancelled appointment.'
            });
        }

        // Check if a prescription already exists for this appointment
        const existingPrescription = await Prescription.findOne({ appointment: appointmentId });
        if (existingPrescription) {
            return res.status(400).json({
                success: false,
                message: `A digital prescription (${existingPrescription.prescriptionNumber}) has already been issued for this appointment.`
            });
        }

        // Generate unique formal prescription number: RX-YYYYMM-XXXX
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        const prescriptionNumber = `RX-${dateStr}-${randomSuffix}`;

        // Create new prescription
        const prescription = await Prescription.create({
            appointment: appointment._id,
            doctor: req.user._id,
            patient: appointment.patient._id,
            prescriptionNumber,
            diagnosis: diagnosis.trim(),
            symptoms: (symptoms && symptoms.trim()) || '',
            medicines,
            advice: (advice && advice.trim()) || 'Follow medication schedule carefully and maintain adequate hydration.',
            followUpDate: (followUpDate && followUpDate.trim()) || ''
        });

        // Link prescription to appointment and mark consultation as completed
        appointment.prescription = prescription._id;
        if (appointment.status !== 'completed') {
            appointment.status = 'completed';
        }
        await appointment.save();

        const populatedPrescription = await Prescription.findById(prescription._id)
            .populate('doctor', 'name email specialization qualifications hospital location')
            .populate('patient', 'name email phone gender dateOfBirth bloodGroup')
            .populate('appointment', 'date timeSlot status fees');

        return res.status(201).json({
            success: true,
            message: 'Digital medical prescription generated and signed successfully.',
            prescription: populatedPrescription
        });
    } catch (error) {
        console.error('Error creating prescription:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error generating digital prescription.',
            error: error.message
        });
    }
};

/**
 * @desc    Get single prescription by ID
 * @route   GET /api/prescriptions/:id
 * @access  Private (Assigned Doctor, Patient, or Admin)
 */
export const getPrescriptionById = async (req, res) => {
    try {
        const { id } = req.params;

        const prescription = await Prescription.findById(id)
            .populate('doctor', 'name email specialization qualifications hospital location')
            .populate('patient', 'name email phone gender dateOfBirth bloodGroup')
            .populate('appointment', 'date timeSlot status fees');

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Prescription not found.'
            });
        }

        // Access Control: Patient, Doctor, or Admin
        const isPatientOwner = prescription.patient._id.toString() === req.user._id.toString();
        const isDoctorOwner = prescription.doctor._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatientOwner && !isDoctorOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not authorized to view another user\'s medical prescription.'
            });
        }

        return res.status(200).json({
            success: true,
            prescription
        });
    } catch (error) {
        console.error('Error retrieving prescription:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving prescription.',
            error: error.message
        });
    }
};

/**
 * @desc    Get prescription associated with an appointment
 * @route   GET /api/prescriptions/appointment/:appointmentId
 * @access  Private (Patient of appointment, Doctor of appointment, or Admin)
 */
export const getPrescriptionByAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        const appointment = await Appointment.findById(appointmentId);
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: 'Appointment not found.'
            });
        }

        // Access control
        const isPatient = appointment.patient.toString() === req.user._id.toString();
        const isDoctor = appointment.doctor.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You are not authorized to access this appointment\'s prescription.'
            });
        }

        const prescription = await Prescription.findOne({ appointment: appointmentId })
            .populate('doctor', 'name email specialization qualifications hospital location')
            .populate('patient', 'name email phone gender dateOfBirth bloodGroup')
            .populate('appointment', 'date timeSlot status fees');

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'No prescription has been generated for this appointment yet.'
            });
        }

        return res.status(200).json({
            success: true,
            prescription
        });
    } catch (error) {
        console.error('Error fetching appointment prescription:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving appointment prescription.',
            error: error.message
        });
    }
};

/**
 * @desc    Get user's prescription history (Doctor: issued prescriptions; Patient: received prescriptions)
 * @route   GET /api/prescriptions/my
 * @access  Private (Patient or Doctor)
 */
export const getMyPrescriptions = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const query = {};

        if (req.user.role === 'patient') {
            query.patient = req.user._id;
        } else if (req.user.role === 'doctor') {
            query.doctor = req.user._id;
        }

        // Search by diagnosis
        if (search && search.trim() !== '') {
            query.diagnosis = { $regex: search.trim(), $options: 'i' };
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSize = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * pageSize;

        const totalPrescriptions = await Prescription.countDocuments(query);
        const prescriptions = await Prescription.find(query)
            .populate('doctor', 'name email specialization qualifications hospital')
            .populate('patient', 'name email phone gender bloodGroup')
            .populate('appointment', 'date timeSlot status fees')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(pageSize);

        return res.status(200).json({
            success: true,
            count: prescriptions.length,
            totalPrescriptions,
            page: pageNum,
            pages: Math.ceil(totalPrescriptions / pageSize) || 1,
            prescriptions
        });
    } catch (error) {
        console.error('Error fetching my prescriptions:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Server error retrieving prescription history.',
            error: error.message
        });
    }
};

/**
 * @desc    Generate and stream medical prescription PDF document
 * @route   GET /api/prescriptions/:id/pdf
 * @access  Private (Assigned Patient, Prescribing Doctor, or Admin)
 */
export const downloadPrescriptionPDF = async (req, res) => {
    try {
        const { id } = req.params;

        const prescription = await Prescription.findById(id)
            .populate('doctor', 'name email specialization qualifications hospital location')
            .populate('patient', 'name email phone gender dateOfBirth bloodGroup')
            .populate('appointment', 'date timeSlot status fees');

        if (!prescription) {
            return res.status(404).json({
                success: false,
                message: 'Prescription record not found.'
            });
        }

        // Privacy check: Patient, Doctor, or Admin only
        const isPatient = prescription.patient._id.toString() === req.user._id.toString();
        const isDoctor = prescription.doctor._id.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isPatient && !isDoctor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You cannot download another patient\'s medical prescription.'
            });
        }

        // Set response headers for PDF download
        const filename = `Prescription-${prescription.prescriptionNumber}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Stream generated PDF
        generatePrescriptionPDF(prescription, res);
    } catch (error) {
        console.error('Error generating prescription PDF:', error.message);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Server error generating prescription PDF.',
                error: error.message
            });
        }
    }
};

