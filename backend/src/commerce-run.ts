import "dotenv/config";
import { db } from "./db.js";
import { processCommerce } from "./commerce.js";
try {
  await processCommerce();
} finally {
  await db.$disconnect();
}
