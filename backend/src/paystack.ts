import { HttpError } from "./errors.js";

type RateLimitInfo = {
  limit?: number | undefined;
  remaining?: number | undefined;
  resetSeconds?: number | undefined;
};

export class PaystackError extends Error {
  constructor(
    public status: number,
    public retryAfterSeconds?: number,
    public rateLimit?: RateLimitInfo,
  ) {
    super("Payment provider request failed.");
  }
}
function secondsUntilReset(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const reset = Number.parseInt(value, 10);
  if (reset > 1_000_000_000) return Math.max(0, Math.ceil(reset - Date.now() / 1000));
  return Math.max(0, reset);
}
function retryAfterSeconds(value: string | null) {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const retryAt = Date.parse(value);
  return Number.isNaN(retryAt) ? undefined : Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}
function headerInteger(value: string | null) {
  return value && /^\d+$/.test(value) ? Number.parseInt(value, 10) : undefined;
}
export function paymentsEnabled() {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  return (
    process.env["PAYMENTS_ENABLED"] === "true" &&
    Boolean(key) &&
    (process.env["NODE_ENV"] !== "production" || key.startsWith("sk_live_"))
  );
}
export function localSandboxCheckoutEnabled() {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  const appUrl = process.env["APP_URL"] || "";
  return (
    process.env["NODE_ENV"] !== "production" &&
    process.env["LOCAL_PAYMENTS_ENABLED"] === "true" &&
    key.startsWith("sk_test_") &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:\/|$)/.test(appUrl)
  );
}
export function marketplaceEnabled() {
  const key = process.env["PAYSTACK_SECRET_KEY"] || "";
  const localTestCheckout = localSandboxCheckoutEnabled();
  return (
    process.env["PAYMENTS_ENABLED"] === "true" &&
    (key.startsWith("sk_live_") || localTestCheckout) &&
    (process.env["PAYMENT_HOLDING_APPROVED"] === "true" || localTestCheckout)
  );
}
export function requirePayments(marketplace = false) {
  if (!(marketplace ? marketplaceEnabled() : paymentsEnabled()))
    throw new HttpError(
      503,
      marketplace
        ? "Online checkout is not available yet. Please check back soon."
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
  if (!response.ok || !body.status) {
    const resetSeconds = secondsUntilReset(response.headers.get("x-ratelimit-reset"));
    throw new PaystackError(
      response.status,
      retryAfterSeconds(response.headers.get("retry-after")) ?? resetSeconds,
      {
        limit: headerInteger(response.headers.get("x-ratelimit-limit")),
        remaining: headerInteger(response.headers.get("x-ratelimit-remaining")),
        resetSeconds,
      },
    );
  }
  return body.data;
}
export type VerifiedPayment = {
  reference: string;
  domain?: string;
  status: string;
  amount: number;
  currency: string;
  customer: { email: string };
  paid_at: string;
};
export const verifyPayment = (reference: string) =>
  paystack<VerifiedPayment>(`/transaction/verify/${encodeURIComponent(reference)}`);
export async function checkout(
  email: string,
  amount: number,
  reference: string,
  subaccount?: string,
) {
  const callback = new URL("/payment/return", process.env["APP_URL"] || "http://localhost:5173");
  return paystack<{ authorization_url: string }>("/transaction/initialize", {
    email,
    amount,
    reference,
    currency: "NGN",
    callback_url: callback.toString(),
    ...(subaccount ? { subaccount, bearer: "subaccount" } : {}),
  });
}
