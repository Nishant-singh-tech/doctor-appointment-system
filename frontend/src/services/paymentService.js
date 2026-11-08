import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/payments`;

/**
 * Initialize a Razorpay payment order for an appointment
 * @param {string} appointmentId
 * @param {string} token
 */
const createPaymentOrder = async (appointmentId, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/create-order`, { appointmentId }, config);
    return response.data;
};

/**
 * Send Razorpay payment confirmation to the server for HMAC-SHA256 signature verification
 * @param {Object} paymentData - { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * @param {string} token
 */
const verifyPayment = async (paymentData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/verify`, paymentData, config);
    return response.data;
};

/**
 * Record a payment dismissal, cancellation, or gateway failure
 * @param {Object} failureData - { appointmentId, orderId, failureReason }
 * @param {string} token
 */
const recordPaymentFailure = async (failureData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/fail`, failureData, config);
    return response.data;
};

/**
 * Request refund for a paid appointment (Admin, Doctor, or Patient)
 * @param {string} appointmentId
 * @param {string} refundReason
 * @param {string} token
 */
const refundPayment = async (appointmentId, refundReason, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(
        `${API_URL}/${appointmentId}/refund`,
        { refundReason },
        config
    );
    return response.data;
};

/**
 * Fetch payment records for a specific appointment
 * @param {string} appointmentId
 * @param {string} token
 */
const getPaymentByAppointment = async (appointmentId, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/appointment/${appointmentId}`, config);
    return response.data;
};

/**
 * Admin view of all system payment transactions with pagination & filters
 * @param {Object} params
 * @param {string} token
 */
const getAdminPayments = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${API_URL}/admin/all`, config);
    return response.data;
};

/**
 * Simulate Razorpay gateway callback for test mode
 * @param {string} orderId
 * @param {string} token
 */
const simulateGatewayCallback = async (orderId, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/simulate-gateway-callback`, { orderId }, config);
    return response.data;
};

const paymentService = {
    createPaymentOrder,
    verifyPayment,
    recordPaymentFailure,
    simulateGatewayCallback,
    refundPayment,
    getPaymentByAppointment,
    getAdminPayments
};

export default paymentService;
