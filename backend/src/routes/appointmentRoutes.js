import express from 'express';
import {
    getAvailableSlots,
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    cancelAppointment,
    updateAppointmentStatus,
    getAdminAppointments
} from '../controllers/appointmentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public route to view available consultation slots
router.get('/slots', getAvailableSlots);

// Protected routes (require valid JWT)
router.use(protect);

router.post('/book', bookAppointment);
router.get('/my', getMyAppointments);
router.get('/admin/all', authorize('admin'), getAdminAppointments);
router.get('/:id', getAppointmentById);
router.put('/:id/cancel', cancelAppointment);
router.put('/:id/status', updateAppointmentStatus);

export default router;
