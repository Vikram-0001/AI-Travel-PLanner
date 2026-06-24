/**
 * api/client.ts
 * Axios instance pointing at the Flask backend (api_server.py).
 * Set VITE_API_BASE_URL in .env to override the default.
 */

import axios, { AxiosError } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000, // 60 s — AI responses can take a while
  headers: {
    'Content-Type': 'application/json',
  },
});

// ── Request interceptor: attach auth token ────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: normalise errors ────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 401 → clear credentials and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    // Build a human-friendly error message
    const data = error.response?.data as Record<string, unknown> | undefined;
    const serverMsg =
      (data?.error as string) ||
      (data?.message as string) ||
      (data?.detail as string) ||
      null;

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Request timed out. The AI is taking too long — please try again.'));
    }

    if (!error.response) {
      // Network error / server is down
      return Promise.reject(
        new Error(
          'Cannot reach the backend. Make sure the API server is running on ' +
            API_BASE_URL
        )
      );
    }

    return Promise.reject(
      new Error(serverMsg || `Server error (${error.response.status})`)
    );
  }
);

export { API_BASE_URL };
export default apiClient;
