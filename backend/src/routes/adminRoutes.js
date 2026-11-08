import express from 'express';
import {
    getAdminStats,
    getUsers,
    getDoctors,
    toggleUserBlock,
    getPendingDoctors,
    verifyDoctor
} from '../controllers/adminController.js';
import { getAdminAppointments } from '../controllers/appointmentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All admin routes require authentication and 'admin' role
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getAdminStats);
router.get('/users', getUsers);
router.get('/doctors', getDoctors);
router.get('/appointments', getAdminAppointments);
router.put('/users/:id/block', toggleUserBlock);
router.get('/doctors/pending', getPendingDoctors);
router.put('/doctors/:id/verify', verifyDoctor);

export default router;

