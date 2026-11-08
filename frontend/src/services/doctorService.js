import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/doctors`;

/**
 * Fetch verified doctors with optional search, filters, and pagination
 */
const getDoctors = async (params = {}) => {
    const response = await axios.get(API_URL, { params });
    return response.data;
};

/**
 * Fetch detailed profile of a single verified doctor
 */
const getDoctorById = async (id) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
};

/**
 * Fetch distinct list of specializations from verified active doctors
 */
const getSpecializations = async () => {
    const response = await axios.get(`${API_URL}/specializations/list`);
    return response.data;
};

/**
 * Get authenticated doctor's own profile
 */
const getMyDoctorProfile = async (token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/profile/me`, config);
    return response.data;
};

/**
 * Update authenticated doctor's own profile
 */
const updateMyDoctorProfile = async (profileData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(`${API_URL}/profile/me`, profileData, config);
    return response.data;
};

/**
 * Submit verification document
 */
const submitVerification = async (documentData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.post(`${API_URL}/verification/submit`, documentData, config);
    return response.data;
};

/**
 * Get authenticated doctor's availability schedule
 */
const getMyAvailability = async (token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/availability/me`, config);
    return response.data;
};

/**
 * Update authenticated doctor's availability schedule
 */
const updateMyAvailability = async (availabilityData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(`${API_URL}/availability/me`, availabilityData, config);
    return response.data;
};

const doctorService = {
    getDoctors,
    getDoctorById,
    getSpecializations,
    getMyDoctorProfile,
    updateMyDoctorProfile,
    submitVerification,
    getMyAvailability,
    updateMyAvailability
};

export default doctorService;
