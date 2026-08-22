import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/AuthContext';
import { createApiClient } from '../lib/api';
import { Button } from '../components/ui';

const BOT_USERNAME = import.meta.env.VITE_SHOP_BOT_USERNAME || 'TezkorShopControlBot';
const IS_DEV = import.meta.env.DEV;

export default function Login() {
  const { login } = useAuth();
  const [status, setStatus] = useState('checking'); // checking | telegram-auth | select-shop | no-telegram | error
  const [errorMessage, setErrorMessage] = useState('');
  const [devLoading, setDevLoading] = useState(false);
  const [identityToken, setIdentityToken] = useState(null);
  const [shopOptions, setShopOptions] = useState([]);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      tg.ready();
      setStatus('telegram-auth');
      const api = createApiClient();
      api.post('/admin/auth/telegram', { initData: tg.initData })
        .then((res) => {
          if (res.needsShopSelection) {
            setIdentityToken(res.identityToken);
            setShopOptions(res.shops);
            setStatus('select-shop');
          } else {
            login(res.token, res.shop);
          }
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Could not verify your Telegram account.');
          setStatus('error');
        });
    } else {
      setStatus('no-telegram');
    }
  }, [login]);

  const chooseShop = async (shopId) => {
    setSelecting(true);
    try {
      const api = createApiClient();
      const { token, shop } = await api.post('/admin/auth/select-shop', { token: identityToken, shopId });
      login(token, shop);
    } catch (err) {
      setErrorMessage(err.message || 'Could not open that shop.');
      setStatus('error');
    } finally {
      setSelecting(false);
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      const api = createApiClient();
      const { token, shop } = await api.post('/admin/auth/dev-login', {});
      login(token, shop);
    } catch (err) {
      setErrorMessage(err.message || 'Dev login failed.');
      setStatus('error');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{ background: 'radial-gradient(circle at 50% 0%, var(--color-accent), transparent 60%)' }}
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm bg-surface border border-border-soft rounded-3xl p-8 text-center shadow-2xl shadow-black/40"
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-accent/15 text-accent flex items-center justify-center font-display text-2xl font-semibold mb-5">T</div>
        <h1 className="font-display text-xl font-semibold mb-1.5">Tezkor Shop Control</h1>

        {status === 'checking' && (
          <p className="text-sm text-text-muted mt-3">Loading…</p>
        )}

        {status === 'telegram-auth' && (
          <div className="flex flex-col items-center gap-3 mt-6">
            <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-muted">Verifying your Telegram account…</p>
          </div>
        )}

        {status === 'select-shop' && (
          <div className="mt-4 space-y-2 text-left">
            <p className="text-sm text-text-muted mb-3 text-center">Which shop would you like to open?</p>
            {shopOptions.map((shop) => (
              <button
                key={shop.id}
                disabled={selecting}
                onClick={() => chooseShop(shop.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-surface-3 hover:border-accent/60 transition-colors disabled:opacity-50"
              >
                <img src={shop.image} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
                <span className="text-sm font-medium text-text truncate">{shop.name?.en || shop.name?.ru}</span>
              </button>
            ))}
          </div>
        )}

        {status === 'no-telegram' && (
          <div className="mt-4 space-y-5">
            <p className="text-sm text-text-muted leading-relaxed">
              Open your dashboard from the <span className="text-text font-medium">Tezkor Shop Control</span> bot
              on Telegram — that's how we verify it's really you.
            </p>
            <Button
              className="w-full"
              onClick={() => window.open(`https://t.me/${BOT_USERNAME}`, '_blank')}
            >
              Open in Telegram
            </Button>
            {IS_DEV && (
              <Button variant="ghost" className="w-full" onClick={handleDevLogin} disabled={devLoading}>
                {devLoading ? 'Signing in…' : 'Continue with dev login'}
              </Button>
            )}
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-danger leading-relaxed">{errorMessage}</p>
            <p className="text-xs text-text-faint leading-relaxed">
              If your shop isn't linked yet, DM the bot with <code className="text-text-muted">/claim YOUR_CODE</code>.
            </p>
            {IS_DEV && (
              <Button variant="ghost" className="w-full" onClick={handleDevLogin} disabled={devLoading}>
                {devLoading ? 'Signing in…' : 'Continue with dev login'}
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
