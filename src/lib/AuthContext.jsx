import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createApiClient } from './api';

const AuthContext = createContext(null);
const STORAGE_KEY = 'tezkor_admin_session';

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);
  const [isVerifying, setIsVerifying] = useState(!!readStoredSession());

  const login = useCallback((token, shop) => {
    const next = { token, shop };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const api = useMemo(() => createApiClient(session?.token), [session?.token]);

  // A stored token can have expired since the last visit — confirm it still
  // works once on load rather than showing stale shop data that 401s later.
  useEffect(() => {
    if (!session?.token) {
      setIsVerifying(false);
      return;
    }
    let cancelled = false;
    api.get('/admin/shop')
      .then((shop) => {
        if (cancelled) return;
        setSession((prev) => (prev ? { ...prev, shop } : prev));
      })
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setIsVerifying(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const value = useMemo(() => ({
    token: session?.token || null,
    shop: session?.shop || null,
    isAuthenticated: !!session?.token,
    isVerifying,
    login,
    logout,
    api,
  }), [session, isVerifying, login, logout, api]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
