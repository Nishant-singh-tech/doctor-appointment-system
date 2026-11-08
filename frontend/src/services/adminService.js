import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/admin`;

/**
 * Fetch system statistics for admin dashboard
 */
const getAdminStats = async (token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/stats`, config);
    return response.data;
};

/**
 * Fetch users with search, role filter, status filter, and pagination
 */
const getUsers = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${API_URL}/users`, config);
    return response.data;
};

/**
 * Fetch doctors with search, verification status filter, block status filter, and pagination
 */
const getDoctors = async (params = {}, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` },
        params
    };
    const response = await axios.get(`${API_URL}/doctors`, config);
    return response.data;
};

/**
 * Admin block or unblock user account
 */
const toggleUserBlock = async (userId, isBlocked, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(`${API_URL}/users/${userId}/block`, { isBlocked }, config);
    return response.data;
};

/**
 * Fetch pending doctor verification requests (Reused from Phase 4)
 */
const getPendingDoctors = async (token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.get(`${API_URL}/doctors/pending`, config);
    return response.data;
};

/**
 * Admin approve or reject doctor verification (Reused from Phase 4)
 */
const verifyDoctor = async (doctorId, verificationData, token) => {
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };
    const response = await axios.put(`${API_URL}/doctors/${doctorId}/verify`, verificationData, config);
    return response.data;
};

const adminService = {
    getAdminStats,
    getUsers,
    getDoctors,
    toggleUserBlock,
    getPendingDoctors,
    verifyDoctor
};

export default adminService;

