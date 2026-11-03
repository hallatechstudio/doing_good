import type { Item } from "./types";
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  membership_until?: string | null;
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
export const currentUser = () => api<Profile | null>("/auth/me");
async function authenticate(path: string, data: unknown) {
  const profile = await api<Profile>(path, "POST", data);
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
    whatsapp: string;
    price_kobo?: number;
  },
) => api<Item>("/items", "POST", data);
export const updateListingStatus = (id: string, status: string) =>
  api(`/items/${id}/status`, "PATCH", { status });
export const updateProfile = (full_name: string, phone: string) =>
  api<Profile>("/profile", "PATCH", { full_name, phone });
export const commerceSettings = () =>
  api<{
    membership_price_kobo: number;
    membership_days: number;
    membership_checkout: boolean;
    protected_checkout: boolean;
    membership_required: boolean;
  }>("/commerce");
export const membershipCheckout = () => api<{ url: string }>("/membership/checkout", "POST", {});
export const buyItem = (item_id: string) => api<{ url: string }>("/orders", "POST", { item_id });
export const verifyCheckout = (reference: string) => api("/payments/verify", "POST", { reference });
export type Order = {
  id: string;
  item_id: string;
  title: string;
  photo?: string;
  amount: number;
  buyer_id: string;
  seller_id: string;
  buyer: string;
  seller: string;
  contact: string;
  status: string;
  reference: string;
  created_at: string;
  release_at: string | null;
  delivery_note: string | null;
  dispute_reason: string | null;
  resolution_note: string | null;
};
export const getOrders = () =>
  api<{ admin: boolean; user_id: string; membership_until: string | null; orders: Order[] }>(
    "/orders",
  );
export const orderAction = (id: string, action: string, data: unknown = {}) =>
  api(`/orders/${id}/${action}`, "POST", data);
export const payoutBanks = () => api<{ name: string; code: string }[]>("/payout/banks");
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
