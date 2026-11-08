import express from 'express';
import { getPatientProfile, updatePatientProfile } from '../controllers/patientController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Private patient profile routes (protected by verified JWT)
router.get('/profile', protect, getPatientProfile);
router.put('/profile', protect, updatePatientProfile);

export default router;
