import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  const refresh = useCallback(async (signal) => {
    try {
      // /auth/session selalu mengembalikan 200. Memakai /auth/me untuk
      // bootstrap membuat error 401 merah di Network saat pengguna masih tamu.
      const data = await api.auth.session(signal);
      const currentUser = data?.user || null;
      setUser(currentUser);
      setStatus(currentUser ? 'authenticated' : 'guest');
      return currentUser;
    } catch (error) {
      if (error?.name === 'AbortError') return null;
      setUser(null);
      setStatus('guest');
      return null;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const data = await api.auth.login(credentials);
    setUser(data);
    setStatus('authenticated');
    return data;
  }, []);

  const register = useCallback((payload) => api.auth.register(payload), []);
  const forgotPassword = useCallback((email) => api.auth.forgotPassword(email), []);
  const resetPassword = useCallback((token, password) => api.auth.resetPassword(token, password), []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setStatus('guest');
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated' && Boolean(user),
      isAdmin: user?.role === 'admin',
      isBos: user?.role === 'bos',
      isCustomer: user?.role === 'customer',
      login,
      register,
      forgotPassword,
      resetPassword,
      logout,
      refresh,
    }),
    [user, status, login, register, forgotPassword, resetPassword, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return context;
}
