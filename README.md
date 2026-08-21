# Tezkor Shop Control — Admin Panel

Admin dashboard for shop owners: manage services, staff, working hours, view
appointments, and see statistics. Pairs with the `barbershop-Backend-main`
API and a dedicated Telegram bot ("shop-control bot") used for login and
appointment notifications.

## Setup

```bash
npm install
cp .env.example .env   # set VITE_SHOP_BOT_USERNAME to your bot's @username
npm run dev            # http://localhost:5173
```

The dev server proxies `/api` and `/socket.io` to `http://localhost:3000` —
run the backend (`barbershop-Backend-main`) alongside this.

## Logging in

This panel authenticates via Telegram, not passwords:

1. In the backend repo, run `node scripts/generateClaimCode.js "<shop name>"`
   to get a one-time claim code for a shop.
2. Have the shop owner open the shop-control bot on Telegram and send
   `/claim CODE`. This links their Telegram account to that shop.
3. The bot replies with an "Open Dashboard" button — tapping it opens this
   panel as a Telegram Mini App and logs them in automatically.

**For local development without Telegram:** click "Continue with dev login"
on the login screen (only available when `npm run dev` is running in
non-production mode — it logs into whichever shop the backend's
`/api/admin/auth/dev-login` picks).

## Notes

- Charts and "most used service"/revenue stats only count `completed`
  bookings — see `routes/adminStats.js` in the backend.
- Live updates (new bookings, status changes) arrive over Socket.io,
  scoped per-shop by the same auth token used for REST calls.
- When developing against the same database/bot tokens as a live
  deployment, set `DISABLE_TELEGRAM_POLLING=true` in the backend's `.env` —
  otherwise your local instance fights the production one for Telegram
  updates. See `barbershop-Backend-main/.env.example`.
