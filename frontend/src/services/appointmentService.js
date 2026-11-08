import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/appointments`;
const ADMIN_API_URL = `${API_BASE}/admin`;

/**
 * Fetch available time slots for a doctor on a given date (Public/Authenticated)
 */
const getAvailableSlots = async (doctorId, date) => {
    const response = await axios.get(`${API_URL}/slots`, {
        params: { doctorId, date }
    });
    return response.data;
};

/**
 * Book an appointment (Authenticated Patient)
 */
const bookAppointment = async (bookingData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/book`, bookingData, config);
    return response.data;
};

/**
 * Fetch user's appointments (Patient: own bookings; Doctor: consultation schedule)
 */
const getMyAppointments = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${API_URL}/my`, config);
    return response.data;
};

/**
 * Fetch single appointment details
 */
const getAppointmentById = async (id, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/${id}`, config);
    return response.data;
};

/**
 * Cancel an appointment (Patient, Doctor, or Admin)
 */
const cancelAppointment = async (id, cancellationReason, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(
        `${API_URL}/${id}/cancel`,
        { cancellationReason },
        config
    );
    return response.data;
};

/**
 * Update appointment status (Doctor or Admin e.g. mark completed)
 */
const updateAppointmentStatus = async (id, statusData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(`${API_URL}/${id}/status`, statusData, config);
    return response.data;
};

/**
 * Admin view of all system appointments
 */
const getAdminAppointments = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${ADMIN_API_URL}/appointments`, config);
    return response.data;
};

const appointmentService = {
    getAvailableSlots,
    bookAppointment,
    getMyAppointments,
    getAppointmentById,
    cancelAppointment,
    updateAppointmentStatus,
    getAdminAppointments
};

export default appointmentService;
