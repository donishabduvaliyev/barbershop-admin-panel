import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined; // undefined = same origin (dev proxy handles it)

// Subscribes to this shop's live appointment events for the lifetime of the
// calling component. `onEvent(payload)` fires for every 'appointment:update'
// pushed by the backend — a booking created via Telegram, or confirmed/
// rejected from either the bot or another open tab of this same panel.
export function useShopSocket(token, onEvent) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!token) return undefined;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      // Same ngrok free-tier interstitial workaround as lib/api.js — only
      // takes effect on the polling fallback (WebSocket upgrades can't
      // carry custom headers from a browser), but ngrok passes true
      // Upgrade requests through untouched anyway.
      extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
    });

    socket.on('appointment:update', (payload) => handlerRef.current?.(payload));

    return () => socket.disconnect();
  }, [token]);
}
