import "dotenv/config";
import { createApp } from "./app.js";
import { db } from "./db.js";

if (process.env["NODE_ENV"] === "production" && !process.env["APP_URL"]?.startsWith("https://")) {
  throw new Error("Production APP_URL must use HTTPS.");
}
const app = createApp();
await db.$connect();
const server = app.listen(Number(process.env["PORT"] || 3001), "0.0.0.0", () =>
  console.log("DoingGood API listening"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
