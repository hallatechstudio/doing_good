# DoingGood

The project has two standalone applications:

- [frontend](frontend/README.md): React app. Run `npm ci` and `npm run dev` from `frontend`.
- [backend](backend/README.md): API, Prisma, PostgreSQL and Postmark. Run `npm ci` and `npm run dev` from `backend`.

Use two terminals for local development. The frontend runs on port 5173 and forwards API requests to the backend on port 3001. Each folder owns its dependencies, lockfile, build, tests and configuration.
