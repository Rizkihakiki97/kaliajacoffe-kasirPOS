export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, { method = 'GET', body, signal, headers = {} } = {}) {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  let response;

  try {
    response = await fetch(`${API_BASE}/api${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined || body === null ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('Tidak dapat terhubung ke server. Pastikan backend berjalan.', 0);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError('Server mengembalikan respons yang tidak valid.', response.status);
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || 'Permintaan gagal.', response.status, payload);
  }

  return payload?.data;
}

const query = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const string = search.toString();
  return string ? `?${string}` : '';
};

export const api = {
  auth: {
    me: (signal) => request('/auth/me', { signal }),
    session: (signal) => request('/auth/session', { signal }),
    login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
    register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
    resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },
  branding: {
    get: (signal) => request('/branding', { signal }),
    update: (form) => request('/branding', { method: 'PUT', body: form }),
  },
  categories: {
    list: (signal) => request('/categories', { signal }),
  },
  products: {
    list: (params, signal) => request(`/products${query(params)}`, { signal }),
    create: (form) => request('/products', { method: 'POST', body: form }),
    update: (id, form) => request(`/products/${id}`, { method: 'PUT', body: form }),
    remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  },
  activities: {
    list: (signal) => request('/activities', { signal }),
    create: (form) => request('/activities', { method: 'POST', body: form }),
    update: (id, form) => request(`/activities/${id}`, { method: 'PUT', body: form }),
    remove: (id) => request(`/activities/${id}`, { method: 'DELETE' }),
  },
  transactions: {
    list: (params, signal) => request(`/transactions${query(params)}`, { signal }),
    pos: (payload) => request('/transactions/pos', { method: 'POST', body: payload }),
    order: (payload) => request('/transactions/order', { method: 'POST', body: payload }),
    uploadReceipt: (id, file) => {
      const form = new FormData();
      form.append('receipt', file);
      return request(`/transactions/${id}/receipt`, { method: 'POST', body: form });
    },
    deleteReceipt: (id) => request(`/transactions/${id}/receipt`, { method: 'DELETE' }),
  },
  bos: {
    transactions: (params, signal) => request(`/bos/transactions${query(params)}`, { signal }),
    stocks: (signal) => request('/bos/stocks', { signal }),
  },
};

export default api;
