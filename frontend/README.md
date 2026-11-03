# DoingGood frontend

React, TypeScript and Vite. Requires Node 22.12+ or Node 24.

## Local setup

Run commands inside this folder:

1. Copy `.env.example` to `.env` if needed.
2. Run `npm ci`.
3. Start `npm run dev` here and separately in `../backend`.

Frontend `.env`:

```dotenv
VITE_API_URL=/api
DEV_API_PROXY_TARGET=http://127.0.0.1:3001
```

`VITE_API_URL` is the public browser API path. Keep it `/api` for the proxy setup. `DEV_API_PROXY_TARGET` is used only by the local Vite proxy. The frontend runs at http://localhost:5173. Private credentials belong only in `backend/.env`.

## Vercel deployment

- Root Directory: `frontend`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Production environment variables: `VITE_API_URL=/api`

The checked-in `vercel.json` forwards `/api/*` to Render before the React page fallback. Browser requests stay on the Vercel origin, so session cookies remain first-party. No wildcard CORS or cross-site cookie settings are needed. Never put Cloudinary secrets, Postmark tokens or database credentials in `VITE_*` variables; Vite includes these public values in browser JavaScript.

On Render, set `APP_URL=https://doinggoodd.vercel.app` and follow [backend setup](../backend/README.md). Local `.env` files are ignored by Git and are not automatically uploaded to either hosting provider. Configure the same values in each provider's Environment settings, then redeploy.

After deployment, `https://doinggoodd.vercel.app/api/health` should return JSON with `ok: true`. Changing frontend variables or the proxy target in `vercel.json` requires a new Vercel deployment. Changing Render settings requires restarting/redeploying the service.

## Commands and features

- `npm run build`: create the production frontend in `dist`.
- `npm test`, `npm run typecheck`, `npm run lint`: verify the app.

Guests browse free and paid listings. Sign in with email and password to list items, join membership, manage a profile and use Orders. Membership is NGN 20,000 for 30 days, renewed manually. Membership payments default to off; until launch, signed-in users retain free-item contact access. Live paid checkout needs an approved holding provider; the current Paystack order implementation is sandbox-only. See [marketplace setup](../backend/MARKETPLACE.md). New users choose Create an account. Use Forgot password to reset your password. Listing photos are hosted on Cloudinary; its API credentials stay on the backend.

The browser API variable must be `VITE_API_URL=/api`, not the Render origin. Keep the `/api` rewrite before the React page fallback. The API host is an explicit public routing destination in `vercel.json`; it is not a secret and does not belong in the browser API base URL. The backend serves API JSON only; the frontend is deployed on Vercel.
