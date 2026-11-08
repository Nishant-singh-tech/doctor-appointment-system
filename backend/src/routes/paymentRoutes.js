import express from 'express';
import {
    createPaymentOrder,
    verifyPayment,
    handlePaymentFailure,
    refundPayment,
    getPaymentByAppointment,
    getAdminPayments,
    simulateGatewayCallback
} from '../controllers/paymentController.js';
import { protect, authorize } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All payment routes require authentication
router.use(protect);

router.post('/create-order', createPaymentOrder);
router.post('/verify', verifyPayment);
router.post('/fail', handlePaymentFailure);
router.post('/simulate-gateway-callback', simulateGatewayCallback);
router.post('/:appointmentId/refund', refundPayment);
router.get('/appointment/:appointmentId', getPaymentByAppointment);
router.get('/admin/all', authorize('admin'), getAdminPayments);

export default router;
