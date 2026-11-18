import type { Item } from "./types";
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  payout_name?: string | null;
};
type Dashboard = {
  profile: Profile;
  listings: Item[];
};
export const AUTH_EVENT = "doinggood:auth";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const apiBaseUrl = (import.meta.env["VITE_API_URL"] || "/api").replace(/\/+$/, "");

async function api<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      response.status,
      body?.error ||
        (response.status === 429
          ? "Too many attempts. Please try again later."
          : "Could not reach the server."),
    );
  return body as T;
}
let currentUserCache: { value: Profile | null; expiresAt: number } | undefined;
export async function currentUser() {
  if (currentUserCache && currentUserCache.expiresAt > Date.now()) return currentUserCache.value;
  const value = await api<Profile | null>("/auth/me");
  currentUserCache = { value, expiresAt: Date.now() + 30_000 };
  return value;
}
async function authenticate(path: string, data: unknown) {
  const profile = await api<Profile>(path, "POST", data);
  currentUserCache = { value: profile, expiresAt: Date.now() + 30_000 };
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: profile }));
  return profile;
}
export const signIn = (email: string, password: string) =>
  authenticate("/auth/login", { email, password });
export const register = (email: string, password: string, full_name: string) =>
  authenticate("/auth/register", { email, password, full_name });
export const forgotPassword = (email: string) =>
  api<{ ok: boolean; message: string }>("/auth/forgot-password", "POST", { email });
export async function resetPassword(token: string, password: string) {
  await api("/auth/reset-password", "POST", { token, password });
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: null }));
}
export async function signOut() {
  await api("/auth/logout", "POST", {});
  currentUserCache = { value: null, expiresAt: Date.now() + 30_000 };
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: null }));
}
export async function listItems() {
  const items: Item[] = [];
  for (let page = 0; ; page++) {
    const batch = await api<Item[]>(`/items?page=${page}`);
    items.push(...batch);
    if (batch.length < 50) return items;
  }
}
export const findItem = (id: string) =>
  api<Item | null>(`/items/${encodeURIComponent(id)}`).catch((error) => {
    if (error.message === "Item not found.") return null;
    throw error;
  });
export const getDashboard = () => api<Dashboard>("/dashboard");
export const addListing = (
  data: Pick<Item, "title" | "description" | "category" | "condition" | "location" | "photos"> & {
    quantity?: number;
    whatsapp: string;
    price_kobo?: number;
    pickup_available?: boolean;
    delivery_fee_kobo?: number | null;
    delivery_area?: string | null;
  },
) => api<Item>("/items", "POST", data);
export const updateListingStatus = (id: string, status: string) =>
  api(`/items/${id}/status`, "PATCH", { status });
export const updateListing = (
  id: string,
  data: Pick<Item, "title" | "description" | "category" | "condition" | "location" | "photos"> & {
    quantity?: number;
    price_kobo?: number;
    pickup_available?: boolean;
    delivery_fee_kobo?: number | null;
    delivery_area?: string | null;
  },
) => api(`/items/${id}`, "PATCH", data);
export async function updateProfile(phone: string) {
  const profile = await api<Profile>("/profile", "PATCH", { phone });
  currentUserCache = { value: profile, expiresAt: Date.now() + 30_000 };
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: profile }));
  return profile;
}
export const commerceSettings = () =>
  api<{ protected_checkout: boolean; test_payments?: boolean }>("/commerce");
export const createTestPayment = (item_id: string, fulfillment_method: "pickup" | "delivery") =>
  api<{ url: string; reference: string; status?: string }>("/orders/test-payment", "POST", {
    item_id,
    fulfillment_method,
  });
export type OrderHistoryEntry = {
  id: string;
  item_id: string;
  title: string;
  photo?: string | null;
  amount: number;
  buyer_id: string;
  seller_id: string;
  status: string;
  test_mode?: boolean;
  reference: string;
  created_at: string;
  buyer: string;
  seller: string;
  contact: string | null;
  fulfillment_method?: "pickup" | "delivery";
  delivery_fee_kobo?: number;
  handoff_status?: "ready" | "shipped" | "received" | null;
  can_track_handoff?: boolean;
  held_payment?: boolean;
  wallet_release?: boolean;
  release_at?: string | null;
  accountability_until?: string | null;
};
export type GiverContact = {
  item_id: string;
  title: string;
  giver: string;
  contact: string | null;
  created_at: string;
};
export const getOrderHistory = () =>
  api<{ user_id: string; orders: OrderHistoryEntry[]; admin?: boolean }>("/orders");
export const getWallet = () => api<{ available: number; pending: number; commission_rate: number; payout_name: string | null; transactions: { id: string; title: string; amount: number; status: string; created_at: string; kind: "sale" | "withdrawal" }[] }>("/wallet");
export const createWithdrawal = (amount: number) =>
  api<{ id: string; status: string }>("/wallet/withdrawals", "POST", { amount });
export type OrderMessage = {
  id: string;
  text: string;
  sender_id: string;
  created_at: string;
};
export const getOrderMessages = (order_id: string) =>
  api<OrderMessage[]>(`/orders/${encodeURIComponent(order_id)}/messages`);
export const sendOrderMessage = (order_id: string, text: string) =>
  api<OrderMessage>(`/orders/${encodeURIComponent(order_id)}/messages`, "POST", { text });
export const getGiverContacts = () => api<GiverContact[]>("/giver-contacts");
export const saveGiverContact = (item_id: string) => api("/giver-contacts", "POST", { item_id });
export const buyItem = (item_id: string, fulfillment_method: "pickup" | "delivery" = "pickup") =>
  api<{ url: string; reference: string }>("/orders", "POST", { item_id, fulfillment_method });
export const updateHandoff = (id: string, action: "ready" | "shipped" | "received") =>
  api<{ ok: boolean }>(`/orders/${encodeURIComponent(id)}/handoff`, "POST", { action });
export const updateHeldOrder = (
  id: string,
  action: "deliver" | "confirm" | "dispute",
  detail: string,
) =>
  api<{ ok: boolean }>(
    `/orders/${encodeURIComponent(id)}/${action}`,
    "POST",
    action === "deliver" ? (detail ? { note: detail } : {}) : action === "dispute" ? { reason: detail } : {},
  );
export const verifyCheckout = (reference: string) =>
  api<{ ok: boolean; test_mode?: boolean }>("/payments/verify", "POST", { reference });
export const payoutBanks = () => api<{ name: string; code: string }[]>("/payout/banks");
export const resolvePayoutName = (bank_code: string, account_number: string) =>
  api<{ account_name: string }>(
    `/payout/resolve?bank_code=${encodeURIComponent(bank_code)}&account_number=${encodeURIComponent(account_number)}`,
  );
export const savePayout = (bank_code: string, account_number: string) =>
  api<{ name: string }>("/payout/account", "POST", { bank_code, account_number });
export async function photoData(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 1000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photo processing is unavailable.");
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.75);
    if (data.length > 1500000) throw new Error("This photo is too large. Choose a smaller image.");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}
