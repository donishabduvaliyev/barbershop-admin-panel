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

  // `data` is either a shop object (role defaults to 'owner', back-compat
  // with every existing caller) or `{ role: 'superadmin' }` with no shop
  // fields — a super admin has no single shop to store.
  const login = useCallback((token, data) => {
    const { role = 'owner', ...shop } = data || {};
    const next = { token, role, shop: role === 'superadmin' ? null : shop };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const api = useMemo(() => createApiClient(session?.token), [session?.token]);

  // Runs once, only for a session already cached from a previous visit
  // (a brand-new visitor has no session yet and goes through Login.jsx's
  // own from-scratch check instead). Whenever real Telegram identity is
  // available, this always re-runs the same /admin/auth/telegram check
  // Login.jsx does on a fresh visit and lets it override whatever the
  // cached session claims.
  //
  // Without this, a browser that ever held someone else's session — a
  // shared/test device, or a super-admin session left over from earlier
  // testing — would keep presenting THEIR role and shop to whoever opens
  // the app next, for the full token lifetime (TOKEN_TTL is 12h, see
  // middleware/adminAuth.js), regardless of who Telegram says is actually
  // opening it now. A cached role must never be trusted over the fresh,
  // cryptographically-signed identity Telegram hands the mini app on every
  // real launch.
  //
  // Deliberately NOT reactive on session.token — running only once per
  // mount avoids the effect re-triggering itself every time a successful
  // check mints a fresh token (JWTs embed an issue time, so even an
  // identical identity gets a new token string each call).
  useEffect(() => {
    if (!session?.token) { setIsVerifying(false); return; }

    let cancelled = false;
    const tg = window.Telegram?.WebApp;

    if (tg?.initData) {
      createApiClient().post('/admin/auth/telegram', { initData: tg.initData })
        .then((res) => {
          if (cancelled) return;
          if (res.needsShopSelection) {
            // Can't resolve a multi-shop pick silently — drop back to a
            // clean logged-out state so Login's own picker UI takes over.
            logout();
          } else if (res.role === 'superadmin') {
            login(res.token, { role: 'superadmin' });
          } else {
            login(res.token, res.shop);
          }
        })
        .catch(() => { if (!cancelled) logout(); })
        .finally(() => { if (!cancelled) setIsVerifying(false); });
      return () => { cancelled = true; };
    }

    // No Telegram context (dev/testing outside Telegram): fall back to the
    // previous lighter check. Superadmin sessions have no single shop to
    // revalidate against here — only reachable via the dev-login carve-out,
    // itself gated off in production (see routes/adminAuth.js).
    if (session.role === 'superadmin') { setIsVerifying(false); return; }
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
  }, []);

  const value = useMemo(() => ({
    token: session?.token || null,
    shop: session?.shop || null,
    role: session?.role || 'owner',
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
