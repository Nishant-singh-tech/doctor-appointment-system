import express from 'express';
import {
    getDoctors,
    getDoctorById,
    getSpecializations,
    getDoctorProfile,
    updateDoctorProfile,
    submitVerification,
    getDoctorAvailability,
    updateDoctorAvailability,
    getPublicDoctorAvailability
} from '../controllers/doctorController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Private doctor routes (protected, doctor-only)
router.get('/profile/me', protect, authorize('doctor'), getDoctorProfile);
router.put('/profile/me', protect, authorize('doctor'), updateDoctorProfile);
router.post('/verification/submit', protect, authorize('doctor'), submitVerification);
router.get('/availability/me', protect, authorize('doctor'), getDoctorAvailability);
router.put('/availability/me', protect, authorize('doctor'), updateDoctorAvailability);

// Public doctor directory routes
router.get('/', getDoctors);
router.get('/specializations/list', getSpecializations);
router.get('/:id', getDoctorById);
router.get('/:id/availability', getPublicDoctorAvailability);

export default router;
