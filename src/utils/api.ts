import axios from 'axios';

// Get the base API URL from environment variables, fallback to local development URL
const apiBaseUrl = (import.meta as any).env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
});

export default api;
