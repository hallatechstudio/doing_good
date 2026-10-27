import "dotenv/config";
import express from "express";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { db } from "./db.js";
const app = createApp();
if (process.env["NODE_ENV"] === "production") {
  if (!process.env["APP_URL"]?.startsWith("https://"))
    throw new Error("Production APP_URL must use HTTPS.");
  const frontendDist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
  const frontendIndex = fileURLToPath(new URL("../../frontend/dist/index.html", import.meta.url));
  if (existsSync(frontendIndex)) {
    app.use(express.static(frontendDist));
    app.get("/{*path}", (_req, res) => res.sendFile(frontendIndex));
  } else {
    app.get("/", (_req, res) => res.json({ service: "DoingGood API", health: "/api/health" }));
  }
}
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
