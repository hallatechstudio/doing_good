# DoingGood backend

Express, Prisma ORM 7 and Neon PostgreSQL power sign-in, donor profiles and listings. Cloudinary stores listing photos. Postmark sends email sign-in codes. Item enquiries and collection arrangements happen directly on WhatsApp; there is no requests dashboard or in-app messaging.

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
- Users sign in with a six-digit email code. Codes expire after 10 minutes and lock after five failed attempts. HTTP-only session cookies expire after 30 days and logout revokes the session.
- After signing in, users without a valid WhatsApp number provide their name and international WhatsApp number. They can update it in Profile or while listing an item. The number is public on their listings, as explained by the forms.
- The donor dashboard contains My listings and Profile. Donors update listing status after agreeing arrangements on WhatsApp.
- Listing creation requires a valid WhatsApp number with country code, such as `+2348012345678`. The server normalizes spaces, parentheses and dashes, and derives owner identity from the session.
- Up to five compressed JPEG photos are sent to the API. The backend uploads them to Cloudinary and stores only HTTPS image URLs in PostgreSQL. Uploads use account credentials on the server; no unsigned upload preset is required.
- If any image upload or the database write fails, assets uploaded during that attempt are deleted. Cloudinary cleanup failures log their public IDs for manual retry. Previously saved listing images are not deleted.

Old request/message tables and migration history are preserved to avoid deleting existing data. The app no longer exposes those APIs or creates request notifications.

## Verification

- `npm test`: database integration tests for sign-in, WhatsApp validation, ownership, Cloudinary URL persistence and partial-upload cleanup. Creates temporary records and removes them. Cloudinary and email sends are mocked.
- `npm run build`, `npm run typecheck`, `npm run lint`.
- `npm run check:db`: confirms database connectivity.
- `npm run check:postmark`: checks Postmark configuration without sending an email.
- `npm run check:cloudinary`: uploads a temporary image, confirms HTTPS image delivery and deletes the test asset.
- `npm run photos:migrate`: moves any legacy database-embedded listing photos to Cloudinary, preserving old values if a listing cannot be updated. Safe to run again; already migrated photos are skipped.
- `GET /api/health`: checks the database connection.

## Production

Use a Node host with HTTPS and outbound access to Neon, Postmark and Cloudinary. Build `../frontend` with `npm ci` and `npm run build`, then run `npm ci` and `npm run build` here. Apply migrations with `npm run db:migrate` during release, then start with `npm start`. Express serves both `frontend/dist` and the API on the same origin.

Set the database, Postmark and Cloudinary variables listed above, plus `NODE_ENV=production`, `APP_URL` to the public HTTPS origin and `PORT` to the assigned port. Set `TRUST_PROXY=1` only when exactly one trusted reverse proxy sits in front of Express. The selected Postmark sender is `support@bethereexperience.com`, with the `outbound` message stream. The account token is not needed by the running app.
