# DoingGood backend

Express, Prisma ORM 7 and Neon PostgreSQL power sign-in, donor profiles and listings. Cloudinary stores listing photos. Postmark sends password reset links. Item enquiries and collection arrangements happen directly on WhatsApp; there is no requests dashboard or in-app messaging.

## Local setup

Requires Node 22.12+ or Node 24. Run commands from this folder.

1. Copy `.env.example` to `.env` if it does not exist.
2. Set `DATABASE_URL`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`, `POSTMARK_MESSAGE_STREAM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
3. Run `npm ci` to install dependencies and generate Prisma Client.
4. Run `npm run db:migrate` to apply migrations.
5. Run `npm run dev` to start the API on port 3001. Start `npm run dev` separately from `../frontend` to run the frontend on port 5173.

Keep credentials in this folder's ignored `.env` or the hosting platform's secret settings. Never put database credentials, Cloudinary secrets or Postmark tokens in frontend files or `VITE_*` variables. The optional Postmark account token is used only by its configuration check.

## User flows

- Guests browse listings and open the donor's WhatsApp using a `wa.me` link with the item title and listing URL. Opening WhatsApp does not reserve an item or create a database request.
- Users create accounts and sign in with email and password. Passwords are salted and hashed with scrypt; plaintext passwords and hashes are never returned by the API. New passwords must contain 12–128 characters. HTTP-only sessions expire after 30 days; logout revokes the session.
- Forgot password sends a one-time Postmark reset link that expires after 30 minutes. Only its hash is stored. Resetting a password revokes every existing session. Users who previously signed in with email codes use this flow to set their first password without losing profiles or listings.
- After signing in or creating an account, users without a valid WhatsApp number provide their name and international WhatsApp number. They can update it in Profile or while listing an item. The number is public on their listings, as explained by the forms.
- The donor dashboard contains My listings and Profile. Donors update listing status after agreeing arrangements on WhatsApp.
- Listing creation requires a valid WhatsApp number with country code, such as `+2348012345678`. The server normalizes spaces, parentheses and dashes, and derives owner identity from the session.
- Up to five compressed JPEG photos are sent to the API. The backend uploads them to Cloudinary and stores only HTTPS image URLs in PostgreSQL. Uploads use account credentials on the server; no unsigned upload preset is required.
- If any image upload or the database write fails, assets uploaded during that attempt are deleted. Cloudinary cleanup failures log their public IDs for manual retry. Previously saved listing images are not deleted.

Old login-code and request/message tables and migration history are preserved to avoid deleting existing data. The app no longer exposes those APIs or creates request notifications.

## Verification

- `npm test`: database integration tests for registration, password login, reset expiry/replay and session revocation, hash privacy, WhatsApp validation, ownership, Cloudinary URL persistence and partial-upload cleanup. Creates temporary records and removes them. Cloudinary and email sends are mocked.
- `npm run build`, `npm run typecheck`, `npm run lint`.
- `npm run check:db`: confirms database connectivity.
- `npm run check:postmark`: checks Postmark configuration without sending an email.
- `npm run check:cloudinary`: uploads a temporary image, confirms HTTPS image delivery and deletes the test asset.
- `npm run photos:migrate`: moves any legacy database-embedded listing photos to Cloudinary, preserving old values if a listing cannot be updated. Safe to run again; already migrated photos are skipped.
- `GET /api/health`: checks the database connection.

## Render configuration for the Vercel frontend

- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm ci --include=dev && npm run build && npm run db:migrate`
- Start Command: `npm start`
- Health Check Path: `/api/health`
- `NODE_ENV=production`
- `APP_URL=https://doinggoodd.vercel.app` (the frontend origin, not the Render URL)
- `TRUST_PROXY=1` for Render's proxy
- Set `DATABASE_URL`, Postmark and Cloudinary credentials in Render's environment settings. Render provides `PORT`.

The backend is API-only and never reads `frontend/dist`. Its root returns API metadata; frontend pages belong on Vercel. Vercel's `frontend/vercel.json` forwards `/api/*` to `https://doing-good.onrender.com/api/*`, so the browser sees API requests as same-origin. Session cookies remain HTTP-only, secure in production, host-only and `SameSite=Lax`. The backend still rejects requests from unexpected browser origins.

No cross-site cookie or wildcard CORS configuration is required for this proxy setup. Direct browser calls to the Render URL are not the configured frontend connection. Use the Vercel `/api` URL for browser authentication and API requests.

Both applications use their own ignored `.env` files locally. Configure these values in Render and Vercel environment settings for deployment; Git does not upload the local files. On Vercel set `VITE_API_URL=/api`. The public Render destination is configured in `frontend/vercel.json`. On Render set `APP_URL=https://doinggoodd.vercel.app`, `NODE_ENV=production`, `TRUST_PROXY=1`, and the existing database, Postmark and Cloudinary secrets.
