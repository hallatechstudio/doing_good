import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/router";
const state = vi.hoisted(() => ({ signedIn: false }));
const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "neighbour@example.com",
  full_name: "Tolu Ade",
  phone: "",
};
const item = {
  id: "10000000-0000-4000-8000-000000000001",
  owner_id: profile.id,
  donor_name: "Tolu",
  donor_whatsapp: "+2348012345678",
  title: "3-Seater Fabric Sofa",
  description: "A comfortable sofa for a new home.",
  category: "furniture",
  condition: "good",
  location: "Yaba, Lagos",
  photos: ["/images/sofa.jpg"],
  status: "available",
  created_at: new Date().toISOString(),
};
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  AUTH_EVENT: "doinggood:auth",
  currentUser: vi.fn(async () => (state.signedIn ? profile : null)),
  listItems: vi.fn(async () => [item]),
  findItem: vi.fn(async (id: string) => (id === item.id ? item : null)),
  getDashboard: vi.fn(async () => ({ profile, listings: [item] })),
  requestCode: vi.fn(async () => ({ ok: true })),
  verifyCode: vi.fn(async () => {
    state.signedIn = true;
    window.dispatchEvent(new CustomEvent("doinggood:auth", { detail: profile }));
    return profile;
  }),
  signOut: vi.fn(async () => {
    state.signedIn = false;
  }),
  updateListingStatus: vi.fn(),
  updateProfile: vi.fn(async (full_name: string, phone: string) => {
    profile.full_name = full_name;
    profile.phone = phone;
    return profile;
  }),
  addListing: vi.fn(),
  photoData: vi.fn(),
}));
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(() => {
  state.signedIn = false;
  profile.phone = "";
  vi.clearAllMocks();
});
afterEach(cleanup);
describe("Connected application routes", () => {
  it("opens the guide and switches between giving and requesting", async () => {
    open("/how-it-works");
    await screen.findByRole("heading", { name: "Small steps. Meaningful change." });
    fireEvent.click(screen.getByRole("button", { name: "I want to give" }));
    expect(screen.getByRole("heading", { name: "Start with what you have." })).toBeInTheDocument();
  });
  it("loads and filters listings from the API", async () => {
    open("/");
    await screen.findByRole("link", { name: item.title });
    fireEvent.change(screen.getByRole("textbox", { name: "Search items" }), {
      target: { value: "no match" },
    });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
  it("requires verification before opening a protected destination", async () => {
    const router = open("/give");
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(router.state.location.search).toBe("?next=%2Fgive");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a code" }));
    await screen.findByLabelText("Six-digit code");
    expect(router.state.location.pathname).toBe("/auth");
    fireEvent.change(screen.getByLabelText("Six-digit code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await screen.findByLabelText("WhatsApp number");
    expect(router.state.location.pathname).toBe("/auth");
    fireEvent.change(screen.getByLabelText("WhatsApp number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByRole("heading", { name: /Something you no longer need/ });
    expect(await screen.findByLabelText("WhatsApp number")).toHaveValue("+2348012345678");
  });
  it("shows listings and WhatsApp profile without a requests tab", async () => {
    state.signedIn = true;
    open("/dashboard");
    await screen.findByRole("heading", { name: "Hello, Tolu." });
    expect(screen.queryByRole("tab", { name: "My requests" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    fireEvent.click(screen.getByRole("tab", { name: "Profile" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Tolu Ade");
  });
  it("lets guests contact donors directly on WhatsApp", async () => {
    open("/items/" + item.id);
    fireEvent.click(await screen.findByRole("button", { name: "Request this item" }));
    const link = await screen.findByRole("link", { name: "Continue on WhatsApp" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/2348012345678");
    expect(url.searchParams.get("text")).toContain(item.title);
    expect(screen.queryByRole("link", { name: "Sign in to request" })).not.toBeInTheDocument();
  });
  it("renders missing items as 404", async () => {
    open("/items/missing");
    await waitFor(() => expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument());
  });
});
