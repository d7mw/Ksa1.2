import axios from 'axios';

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const api = axios.create({ baseURL: BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ksa1_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      if (path !== '/login') {
        localStorage.removeItem('ksa1_token');
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  signupStart: (data) => api.post('/auth/signup/start', data).then((r) => r.data),
  signupVerify: (data) => api.post('/auth/signup/verify', data).then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  google: (data) => api.post('/auth/google', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  checkUsername: (username) => api.post('/auth/check-username', { username }).then((r) => r.data),
  forgotStart: (email) => api.post('/auth/forgot-password/start', { email }).then((r) => r.data),
  forgotVerify: (data) => api.post('/auth/forgot-password/verify', data).then((r) => r.data),
};

// Users
export const usersApi = {
  updateMe: (data) => api.patch('/users/me', data).then((r) => r.data),
  get: (username) => api.get(`/users/${username}`).then((r) => r.data),
  follow: (username) => api.post(`/users/${username}/follow`).then((r) => r.data),
  followers: (username) => api.get(`/users/${username}/followers`).then((r) => r.data),
  following: (username) => api.get(`/users/${username}/following`).then((r) => r.data),
  suggestions: () => api.get('/users/suggestions/list').then((r) => r.data),
  tweets: (username, kind = 'posts') => api.get(`/users/${username}/tweets`, { params: { kind } }).then((r) => r.data),
  requestVerification: (plan) => api.post('/users/me/request-verification', null, { params: { plan } }).then((r) => r.data),
};

// Tweets
export const tweetsApi = {
  create: (data) => api.post('/tweets', data).then((r) => r.data),
  feed: (tab = 'forYou') => api.get('/tweets/feed', { params: { tab } }).then((r) => r.data),
  get: (id) => api.get(`/tweets/${id}`).then((r) => r.data),
  replies: (id) => api.get(`/tweets/${id}/replies`).then((r) => r.data),
  delete: (id) => api.delete(`/tweets/${id}`).then((r) => r.data),
  like: (id) => api.post(`/tweets/${id}/like`).then((r) => r.data),
  retweet: (id) => api.post(`/tweets/${id}/retweet`).then((r) => r.data),
};

// Notifications
export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  unreadCount: () => api.get('/notifications/unread-count').then((r) => r.data),
};

// Search
export const searchApi = {
  tweets: (q) => api.get('/search/tweets', { params: { q } }).then((r) => r.data),
  users: (q) => api.get('/search/users', { params: { q } }).then((r) => r.data),
};

// Direct Messages
export const messagesApi = {
  conversations: () => api.get('/messages/conversations').then((r) => r.data),
  unreadCount: () => api.get('/messages/unread-count').then((r) => r.data),
  start: (username) => api.post('/messages/conversations', { username }).then((r) => r.data),
  get: (id, before) => api.get(`/messages/conversations/${id}`, { params: before ? { before } : {} }).then((r) => r.data),
  send: (id, data) => api.post(`/messages/conversations/${id}`, data).then((r) => r.data),
  markRead: (id) => api.post(`/messages/conversations/${id}/read`).then((r) => r.data),
  remove: (id) => api.delete(`/messages/conversations/${id}`).then((r) => r.data),
};

// Admin
export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  users: (q = '', skip = 0) => api.get('/admin/users', { params: { q, skip } }).then((r) => r.data),
  verify: (id) => api.post(`/admin/users/${id}/verify`).then((r) => r.data),
  unverify: (id) => api.post(`/admin/users/${id}/unverify`).then((r) => r.data),
  ban: (id) => api.post(`/admin/users/${id}/ban`).then((r) => r.data),
  unban: (id) => api.post(`/admin/users/${id}/unban`).then((r) => r.data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`).then((r) => r.data),
  verificationRequests: (status = 'pending') => api.get('/admin/verification-requests', { params: { status } }).then((r) => r.data),
  rejectRequest: (id) => api.post(`/admin/verification-requests/${id}/reject`).then((r) => r.data),
  tweets: (q = '', skip = 0) => api.get('/admin/tweets', { params: { q, skip } }).then((r) => r.data),
  deleteTweet: (id) => api.delete(`/admin/tweets/${id}`).then((r) => r.data),
};

export const setToken = (token) => {
  if (token) localStorage.setItem('ksa1_token', token);
  else localStorage.removeItem('ksa1_token');
};

export const getToken = () => localStorage.getItem('ksa1_token');
