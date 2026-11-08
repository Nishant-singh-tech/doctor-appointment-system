import express from 'express';
import { register, login, getProfile } from '../controllers/authController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', protect, getProfile);

// Role-based authorization verification endpoints
router.get('/patient-only', protect, authorize('patient'), (req, res) => {
    res.status(200).json({ success: true, message: 'Patient access authorized' });
});
router.get('/doctor-only', protect, authorize('doctor'), (req, res) => {
    res.status(200).json({ success: true, message: 'Doctor access authorized' });
});
router.get('/admin-only', protect, authorize('admin'), (req, res) => {
    res.status(200).json({ success: true, message: 'Admin access authorized' });
});

export default router;
