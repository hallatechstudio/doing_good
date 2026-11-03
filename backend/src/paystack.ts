import { HttpError } from "./errors.js";

export class PaystackError extends Error {
  constructor(public status: number) {
    super("Payment provider request failed.");
  }
}
export function paymentsEnabled() {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  return (
    process.env["PAYMENTS_ENABLED"] === "true" &&
    Boolean(key) &&
    (process.env["NODE_ENV"] !== "production" || key.startsWith("sk_live_"))
  );
}
export function marketplaceEnabled() {
  // Paystack's published policy excludes escrow. This adapter is sandbox-only;
  // a real holding provider must replace it before live paid orders can launch.
  return (
    paymentsEnabled() &&
    Boolean(process.env["PAYSTACK_SECRET_KEY"]?.startsWith("sk_test_")) &&
    process.env["PAYSTACK_HOLDING_APPROVED"] === "true" &&
    Boolean(process.env["COMMERCE_ADMIN_EMAILS"]?.trim())
  );
}
export function requirePayments(marketplace = false) {
  if (!(marketplace ? marketplaceEnabled() : paymentsEnabled()))
    throw new HttpError(
      503,
      marketplace
        ? "Protected checkout is not available yet. Please check back soon."
        : "Membership checkout is not available yet. Please check back soon.",
    );
}
export async function paystack<T>(path: string, data?: unknown): Promise<T> {
  const secret = process.env["PAYSTACK_SECRET_KEY"];
  if (!secret) throw new HttpError(503, "Payments are not configured.");
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    signal: AbortSignal.timeout(20000),
  });
  const body = (await response.json()) as { status: boolean; data: T };
  if (!response.ok || !body.status) throw new PaystackError(response.status);
  return body.data;
}
export type VerifiedPayment = {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  customer: { email: string };
  paid_at: string;
};
export const verifyPayment = (reference: string) =>
  paystack<VerifiedPayment>(`/transaction/verify/${encodeURIComponent(reference)}`);
export async function checkout(email: string, amount: number, reference: string) {
  const callback = new URL("/orders", process.env["APP_URL"] || "http://localhost:5173");
  return paystack<{ authorization_url: string }>("/transaction/initialize", {
    email,
    amount,
    reference,
    currency: "NGN",
    callback_url: callback.toString(),
  });
}
