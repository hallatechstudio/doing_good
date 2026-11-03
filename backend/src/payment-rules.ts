import { createHmac, timingSafeEqual } from "node:crypto";

export const MEMBERSHIP_PRICE = 2_000_000;
export const REVIEW_MS = 24 * 60 * 60 * 1000;
export function isMember(until: Date | null | undefined, now = new Date()) {
  return Boolean(until && until > now);
}
export function membershipExpiry(current: Date | null, now = new Date()) {
  // A membership is a clearly disclosed 30-day pass; early renewal extends it.
  return new Date(Math.max(current?.getTime() || 0, now.getTime()) + 30 * 86400000);
}
export function releaseDue(status: string, deadline: Date | null, now = new Date()) {
  return status === "delivered" && Boolean(deadline && deadline <= now);
}
export function validSignature(raw: Buffer, signature: string, secret: string) {
  if (!secret || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
