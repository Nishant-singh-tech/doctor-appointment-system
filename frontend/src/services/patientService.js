import axios from 'axios';
import API_BASE from './apiConfig';

const API_URL = `${API_BASE}/patients`;

/**
 * Get patient profile
 */
const getPatientProfile = async (token) => {
    const config = {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
    const response = await axios.get(`${API_URL}/profile`, config);
    return response.data;
};

/**
 * Update patient profile
 */
const updatePatientProfile = async (profileData, token) => {
    const config = {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };
    const response = await axios.put(`${API_URL}/profile`, profileData, config);
    if (response.data.user) {
        // Update local storage user data
        localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
};

const patientService = {
    getPatientProfile,
    updatePatientProfile
};

export default patientService;
