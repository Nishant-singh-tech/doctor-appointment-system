/**
 * API Base Configuration
 * In local development, defaults to 'http://localhost:5000/api'
 * Supports VITE_API_URL (with or without '/api' suffix) or falls back cleanly.
 */
const getApiBase = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl.trim() !== '' && envUrl !== 'undefined') {
        const trimmed = envUrl.trim().replace(/\/+$/, '');
        return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
    }
    return 'http://localhost:5000/api';
};

const API_BASE = getApiBase();

export default API_BASE;
