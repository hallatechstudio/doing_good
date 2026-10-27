import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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
  signIn: vi.fn(async () => {
    state.signedIn = true;
    window.dispatchEvent(new CustomEvent("doinggood:auth", { detail: profile }));
    return profile;
  }),
  register: vi.fn(async () => {
    state.signedIn = true;
    window.dispatchEvent(new CustomEvent("doinggood:auth", { detail: profile }));
    return profile;
  }),
  forgotPassword: vi.fn(async () => ({
    ok: true,
    message: "If an account exists for this email, a password reset link has been sent.",
  })),
  resetPassword: vi.fn(async () => ({ ok: true })),
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
  it("signs in with email and password, then completes WhatsApp setup", async () => {
    const router = open("/give");
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(router.state.location.search).toBe("?next=%2Fgive");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    expect(screen.queryByLabelText("Full name (for new accounts)")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Sign in" }));
    await screen.findByLabelText("WhatsApp number");
    expect(router.state.location.pathname).toBe("/auth");
    fireEvent.change(screen.getByLabelText("WhatsApp number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByRole("heading", { name: /Something you no longer need/ });
    expect(await screen.findByLabelText("WhatsApp number")).toHaveValue("+2348012345678");
  });
  it("shows a separate account creation form", async () => {
    open("/auth");
    fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Tolu Ade" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByLabelText("WhatsApp number");
    const api = await import("@/lib/api");
    expect(api.register).toHaveBeenCalledWith(
      profile.email,
      "Neighbour password 2026!",
      "Tolu Ade",
    );
  });
  it("lets existing email-code users request a password setup link", async () => {
    open("/auth");
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await screen.findByRole("status");
    expect(
      screen.getByText("If an account exists for this email, a password reset link has been sent."),
    ).toBeInTheDocument();
    expect(state.signedIn).toBe(false);
  });
  it("accepts a reset link and returns to password sign-in", async () => {
    const token = "a".repeat(64);
    open("/auth?reset=" + token);
    fireEvent.change(await screen.findByLabelText("New password"), {
      target: { value: "A different long password!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "A different long password!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    const api = await import("@/lib/api");
    expect(api.resetPassword).toHaveBeenCalledWith(token, "A different long password!");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
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
  it("asks guests to create an account before requesting an item", async () => {
    open("/items/" + item.id);
    fireEvent.click(await screen.findByRole("button", { name: "Request this item" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Create an account to request this item" }),
    );
    expect(dialog.getByRole("button", { name: "Create an account" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(dialog.queryByRole("link", { name: "Continue on WhatsApp" })).not.toBeInTheDocument();
  });
  it("signs a guest up inside the request dialog and keeps the item page underneath", async () => {
    const router = open("/items/" + item.id);
    fireEvent.click(await screen.findByRole("button", { name: "Request this item" }));
    const gate = within(
      await screen.findByRole("dialog", { name: "Create an account to request this item" }),
    );
    fireEvent.click(gate.getByRole("button", { name: "Create an account" }));
    await screen.findByRole("heading", { name: "Create your account" });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Tolu Ade" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(await screen.findByLabelText("WhatsApp number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    const link = await screen.findByRole("link", { name: "Continue on WhatsApp" });
    expect(new URL(link.getAttribute("href")!).pathname).toBe("/2348012345678");
    expect(router.state.location.pathname).toBe("/items/" + item.id);
  });
  it("opens sign in as a modal without leaving the page", async () => {
    const router = open("/");
    await screen.findByRole("link", { name: item.title });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Welcome back" }));
    fireEvent.change(dialog.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.change(dialog.getByLabelText("Password"), {
      target: { value: "Neighbour password 2026!" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Sign in" }));
    fireEvent.change(await screen.findByLabelText("WhatsApp number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });
  it("lets signed-in members contact donors directly on WhatsApp", async () => {
    state.signedIn = true;
    open("/items/" + item.id);
    fireEvent.click(await screen.findByRole("button", { name: "Request this item" }));
    const link = await screen.findByRole("link", { name: "Continue on WhatsApp" });
    const url = new URL(link.getAttribute("href")!);
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/2348012345678");
    expect(url.searchParams.get("text")).toContain(item.title);
  });
  it("renders missing items as 404", async () => {
    open("/items/missing");
    await waitFor(() => expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument());
  });
});
