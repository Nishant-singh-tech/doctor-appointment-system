/**
 * API Configuration
 * Supports environment-based base URL (e.g., VITE_API_URL for decoupled hosting),
 * relative path '/api' for production unified hosting (Express static serving or reverse proxy),
 * and falls back to 'http://localhost:5000/api' for local development.
 */
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export default API_BASE;

