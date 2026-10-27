import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `scrypt$32768$8$3$${salt}$${key.toString("hex")}`;
}
const dummyHash = hashPassword(randomBytes(32).toString("hex"));
export async function verifyPassword(password: string, stored: string | null) {
  const format = /^scrypt\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
  const validFormat = stored ? format.exec(stored) : null;
  const parts = validFormat || format.exec(await dummyHash)!;
  const actual = await derive(password, parts[1]!);
  const matches = timingSafeEqual(actual, Buffer.from(parts[2]!, "hex"));
  return Boolean(validFormat) && matches;
}
