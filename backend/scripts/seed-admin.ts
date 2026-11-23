import "dotenv/config";
import { db } from "../src/db.js";
import { hashPassword } from "../src/passwords.js";

const email = process.env["ADMIN_SEED_EMAIL"]?.trim().toLowerCase();
const password = process.env["ADMIN_SEED_PASSWORD"];
const fullName = process.env["ADMIN_SEED_NAME"]?.trim() || "DoingGood Administrator";

if (!email || !password) throw new Error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD in .env first.");
if (password.length < 8) throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters.");

const password_hash = await hashPassword(password);
const user = await db.user.upsert({
  where: { email },
  create: { email, full_name: fullName, password_hash },
  update: { password_hash },
  select: { email: true, full_name: true },
});

console.log(`Admin account seeded for ${user.email} (${user.full_name}).`);
await db.$disconnect();
