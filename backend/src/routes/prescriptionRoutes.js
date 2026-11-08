import express from 'express';
import {
    createPrescription,
    getPrescriptionById,
    getPrescriptionByAppointment,
    getMyPrescriptions,
    downloadPrescriptionPDF
} from '../controllers/prescriptionController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All prescription routes require authentication
router.use(protect);

// Doctor only: Generate new prescription
router.post('/', authorize('doctor'), createPrescription);

// User prescription history (scoped to Patient or Doctor)
router.get('/my', getMyPrescriptions);

// Single prescription by Appointment ID
router.get('/appointment/:appointmentId', getPrescriptionByAppointment);

// Download Prescription as official PDF
router.get('/:id/pdf', downloadPrescriptionPDF);

// Single prescription by ID
router.get('/:id', getPrescriptionById);

export default router;

