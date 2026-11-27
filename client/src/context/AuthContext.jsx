import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, getAccessToken, onSessionChange, refreshSession, setSession } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const queryClient = useQueryClient();

  useEffect(() => {
    return onSessionChange((next) => {
      setUser(next);
      setStatus(next ? 'authenticated' : 'anonymous');
      if (next) connectSocket(getAccessToken());
      else disconnectSocket();
    });
  }, []);

  useEffect(() => {
    refreshSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const session = await api.post('/api/auth/login', { email, password });
    setSession(session);
    return session.user;
  }, []);

  const register = useCallback(async (data) => {
    const session = await api.post('/api/auth/register', data);
    setSession(session);
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setSession(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, login, register, logout, updateUser: setUser }),
    [user, status, login, register, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export const homeFor = (role) => ({ admin: '/admin', club: '/club', student: '/dashboard' })[role] ?? '/';
