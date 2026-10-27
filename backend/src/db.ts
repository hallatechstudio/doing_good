import "dotenv/config";
import { PrismaClient } from "./generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL must be configured.");
const url = new URL(connectionString);
// Keep certificate verification explicit for current and future pg versions.
if (url.searchParams.get("sslmode") === "require") url.searchParams.set("sslmode", "verify-full");
const adapter = new PrismaPg({
  connectionString: url.toString(),
  max: 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});
export const db = new PrismaClient({
  adapter,
  transactionOptions: { timeout: 15000, maxWait: 10000 },
});
