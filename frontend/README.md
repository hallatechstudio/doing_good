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
BACKEND_URL=https://doing-good.onrender.com
DEV_API_PROXY_TARGET=http://127.0.0.1:3001
```

`VITE_API_URL` is the public browser API path. Keep it `/api` for the proxy setup. `BACKEND_URL` is the production Render origin used by Vercel configuration. `DEV_API_PROXY_TARGET` is used only by the local Vite proxy. The frontend runs at http://localhost:5173. Private credentials belong only in `backend/.env`.

## Vercel deployment

- Root Directory: `frontend`
- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- Production environment variables: `VITE_API_URL=/api` and `BACKEND_URL=https://doing-good.onrender.com`

The checked-in `vercel.ts` reads `BACKEND_URL` from the environment and forwards `/api/*` to Render before the React page fallback. Browser requests stay on the Vercel origin, so session cookies remain first-party. No wildcard CORS or cross-site cookie settings are needed. Never put Cloudinary secrets, Postmark tokens or database credentials in `VITE_*` variables; Vite includes these public values in browser JavaScript.

On Render, set `APP_URL=https://doinggood-gray.vercel.app` and follow [backend setup](../backend/README.md). Local `.env` files are ignored by Git and are not automatically uploaded to either hosting provider. Configure the same values in each provider's Environment settings, then redeploy.

After deployment, `https://doinggood-gray.vercel.app/api/health` should return JSON with `ok: true`. Changing frontend variables or the proxy target requires a new Vercel deployment. Changing Render settings requires restarting/redeploying the service.

## Commands and features

- `npm run build`: create the production frontend in `dist`.
- `npm test`, `npm run typecheck`, `npm run lint`: verify the app.

Guests contact donors directly on WhatsApp. Signing in is for listing items and managing a donor profile. Listing photos are hosted on Cloudinary; its API credentials stay on the backend.
