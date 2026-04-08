import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Endpoints
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  logout: () => apiClient.post('/auth/logout'),
  getProfile: () => apiClient.get('/auth/profile'),
  updateProfile: (data) => apiClient.patch('/auth/profile', data),
};

// Habit Endpoints
export const habitsAPI = {
  create: (data) => apiClient.post('/habits', data),
  getAll: () => apiClient.get('/habits'),
  getById: (id) => apiClient.get(`/habits/${id}`),
  update: (id, data) => apiClient.put(`/habits/${id}`, data),
  delete: (id) => apiClient.delete(`/habits/${id}`),
  toggle: (id) => apiClient.patch(`/habits/${id}/toggle`),
};

// Completion Endpoints
export const completionsAPI = {
  mark: (data) => apiClient.post('/completions', data),
  getToday: () => apiClient.get('/completions/today'),
  getHistory: (habitId) => apiClient.get(`/completions/habit/${habitId}`),
  getStats: () => apiClient.get('/completions/stats'),
  undo: (id) => apiClient.delete(`/completions/${id}`),
};

// Stats Endpoints
export const statsAPI = {
  dashboard: () => apiClient.get('/stats/dashboard'),
};

// Task Endpoints
export const tasksAPI = {
  createTopic: (data) => apiClient.post('/tasks/topics', data),
  create: (data) => apiClient.post('/tasks', data),
  getAll: () => apiClient.get('/tasks'),
  getTopics: () => apiClient.get('/tasks/topics'),
  update: (id, data) => apiClient.put(`/tasks/${id}`, data),
  toggleComplete: (id) => apiClient.patch(`/tasks/${id}/toggle-complete`),
  delete: (id) => apiClient.delete(`/tasks/${id}`),
};

// Goal Endpoints
export const goalsAPI = {
  createTopic: (data) => apiClient.post('/goals/topics', data),
  create: (data) => apiClient.post('/goals', data),
  getAll: () => apiClient.get('/goals'),
  getTopics: () => apiClient.get('/goals/topics'),
  update: (id, data) => apiClient.put(`/goals/${id}`, data),
  toggleComplete: (id) => apiClient.patch(`/goals/${id}/toggle-complete`),
  delete: (id) => apiClient.delete(`/goals/${id}`),
};

export default apiClient;
