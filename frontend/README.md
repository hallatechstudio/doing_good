# DoingGood frontend

React, TypeScript and Vite. Requires Node 22.12+ or Node 24.

Run these commands from this folder:

- `npm ci`: install frontend dependencies.
- `npm run dev`: start the frontend at http://localhost:5173.
- `npm run build`: create the production build in `dist/`.
- `npm test`, `npm run typecheck`, `npm run lint`: verify the app.

Run `npm run dev` separately from `../backend` to start the API on port 3001. Vite proxies `/api` there. Credentials belong in `backend/.env`.

For production, build this frontend before building and starting the backend. The backend serves `frontend/dist` and the API together on one origin. See [backend setup](../backend/README.md) for database, email and deployment configuration.

Guests contact donors directly on WhatsApp. Signing in is for listing items and managing a donor profile. Users add an international WhatsApp number before publishing. Listing photos are hosted on Cloudinary; its API credentials stay in the backend.
