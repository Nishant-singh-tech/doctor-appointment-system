import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/prescriptions`;

/**
 * Doctor: Create a new digital medical prescription
 * @param {Object} prescriptionData - { appointmentId, diagnosis, symptoms, medicines, advice, followUpDate }
 * @param {string} token
 */
const createPrescription = async (prescriptionData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(API_URL, prescriptionData, config);
    return response.data;
};

/**
 * Get prescription by ID
 * @param {string} id
 * @param {string} token
 */
const getPrescriptionById = async (id, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/${id}`, config);
    return response.data;
};

/**
 * Get prescription associated with a specific appointment
 * @param {string} appointmentId
 * @param {string} token
 */
const getPrescriptionByAppointment = async (appointmentId, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/appointment/${appointmentId}`, config);
    return response.data;
};

/**
 * Get logged-in user's prescriptions (Patient: received; Doctor: issued)
 * @param {Object} params - { search, page, limit }
 * @param {string} token
 */
const getMyPrescriptions = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${API_URL}/my`, config);
    return response.data;
};

/**
 * Download prescription as PDF file
 * @param {string} id - Prescription ID
 * @param {string} prescriptionNumber - Used for downloaded filename
 * @param {string} token
 */
const downloadPrescriptionPDF = async (id, prescriptionNumber, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
    };
    const response = await axios.get(`${API_URL}/${id}/pdf`, config);

    // Create a Blob from the PDF Stream
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `Prescription-${prescriptionNumber || id}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return true;
};

const prescriptionService = {
    createPrescription,
    getPrescriptionById,
    getPrescriptionByAppointment,
    getMyPrescriptions,
    downloadPrescriptionPDF
};

export default prescriptionService;

