# DoingGood frontend

React, TypeScript and Vite. Requires Node 22.12+ or Node 24.

## Local setup

From this folder run `npm ci`, then `npm run dev`. Run `npm run dev` separately in
`../backend` for the API. Keep both applications local while reviewing changes; do not push
or deploy until requested. No Docker is needed.

Frontend `.env`:

```dotenv
VITE_API_URL=/api
DEV_API_PROXY_TARGET=http://127.0.0.1:3001
```

Open http://localhost:5173. The frontend proxies `/api` to the local backend. Use your own
account and existing listings; there are no sample accounts or role-switching controls.
Keep payment secrets, database credentials and email tokens in backend `.env` only.

## Shopping flow

- Item photos, titles and **View item** open the same scrollable dialog, capped at 85dvh.
  Photos have previous/next controls and thumbnails. Keyboard arrows switch photos.
- **Add to cart** works for free and paid items. The cart stores listing IDs in this browser,
  without reserving inventory. One listing is one item; duplicates are prevented and the
  maximum selection is 20 listings.
- **View cart** opens a normal page showing every selected item, remove/clear actions and a
  total. Current prices and availability are fetched from the backend before checkout.
- **Buy now** opens a separate checkout page for that item. **Continue to checkout** buys
  the selection from the cart. Sign-in and account setup are separate pages, not extra dialogs.
- Free items have no purchase price. Signed-in users can contact donors directly on WhatsApp
  from the item dialog or checkout collection section. There is no subscription or access fee.
- Sellers manage listings and profiles in Dashboard. **Add payments** opens inline on paid
  listings. Signed-in users can review orders and free-item contacts in Order history.

## Online checkout

The checkout flow handles one paid item per charge. A verified payment immediately marks the
listing sold, then the funds remain pending until the buyer confirms receipt or the 24-hour
delivery review period ends without a dispute. Free items are arranged directly with each giver.

Checkout remains unavailable until a payment provider has approved this held-payment arrangement.
There is no customer-facing simulated payment path. After provider verification, buyers can open
Order history. The cart removes only items from a verified payment that belongs to the current buyer.
## Vercel deployment (when requested)

- Root Directory: `frontend`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Public environment variable: `VITE_API_URL=/api`

`vercel.json` proxies `/api/*` to Render before the SPA fallback. Render uses the backend
folder and `APP_URL=https://doinggoodd.vercel.app`. Local env files are ignored and are not
uploaded automatically. See `../backend/README.md` and `../backend/MARKETPLACE.md`.

## Checks

`npm run typecheck`, `npm test`, `npm run build`, `npm run lint`.
