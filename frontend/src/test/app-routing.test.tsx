import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routes } from "@/router";
import { readCartIds } from "@/lib/cart";
const state = vi.hoisted(() => ({ signedIn: false }));
const profile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "buyer@example.com",
  full_name: "Tolu Ade",
  phone: "+2348012345678",
  payout_name: null as string | null,
};
const paid = {
  id: "10000000-0000-4000-8000-000000000001",
  owner_id: "00000000-0000-4000-8000-000000000002",
  donor_name: "Ada",
  donor_whatsapp: "",
  title: "Fabric Sofa",
  description: "A comfortable sofa for a new home.",
  category: "furniture",
  condition: "good",
  location: "Yaba, Lagos",
  photos: ["/images/sofa.jpg", "/images/sofa.jpg?second"],
  price_kobo: 3000000,
  status: "available",
  created_at: "2026-11-03T00:00:00Z",
};
const second = {
  ...paid,
  id: "20000000-0000-4000-8000-000000000001",
  title: "Dining Chair",
  price_kobo: 2000000,
};
const free = {
  ...paid,
  id: "30000000-0000-4000-8000-000000000001",
  title: "Free Books",
  donor_whatsapp: "+2348012345678",
  price_kobo: 0,
  category: "books",
};
const owned = {
  ...paid,
  id: "40000000-0000-4000-8000-000000000001",
  owner_id: profile.id,
  title: "My paid listing",
};
const items = [paid, second, free];
vi.mock("@/lib/api", () => ({
  ApiError: class extends Error {},
  AUTH_EVENT: "doinggood:auth",
  currentUser: vi.fn(async () => (state.signedIn ? profile : null)),
  commerceSettings: vi.fn(async () => ({ protected_checkout: false, test_payments: false })),
  listItems: vi.fn(async () => items),
  findItem: vi.fn(async (id: string) => [...items, owned].find((item) => item.id === id) || null),
  getDashboard: vi.fn(async () => ({ profile, listings: [owned] })),
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
    window.dispatchEvent(new CustomEvent("doinggood:auth", { detail: null }));
  }),
  updateListingStatus: vi.fn(async () => ({ ok: true })),
  updateProfile: vi.fn(async (full_name: string, phone: string) => {
    profile.full_name = full_name;
    profile.phone = phone;
    return profile;
  }),
  addListing: vi.fn(),
  photoData: vi.fn(),
  buyItem: vi.fn(),
  createTestPayment: vi.fn(async () => ({
    url: "https://checkout.paystack.com/test-session",
    reference: "dg-order-00000000-0000-4000-8000-000000000001",
    status: "test_pending_payment",
  })),
  saveGiverContact: vi.fn(async () => ({ ok: true })),
  getOrderHistory: vi.fn(async () => ({
    user_id: profile.id,
    orders: [
      {
        id: "order-1",
        item_id: paid.id,
        title: paid.title,
        amount: paid.price_kobo + 250000,
        delivery_fee_kobo: 250000,
        fulfillment_method: "delivery",
        paid_at: "2026-11-23T12:00:00.000Z",
        paid_amount: paid.price_kobo + 250000,
        held_payment: true,
        buyer_id: profile.id,
        seller_id: paid.owner_id,
        buyer: profile.full_name,
        seller: "Ada",
        status: "paid",
        reference: "order-reference",
        created_at: paid.created_at,
        contact: "+2348098765432",
      },
    ],
  })),
  getGiverContacts: vi.fn(async () => [
    {
      item_id: free.id,
      title: free.title,
      giver: "Ada",
      contact: free.donor_whatsapp,
      created_at: free.created_at,
    },
  ]),
  getOrderMessages: vi.fn(async () => []),
  sendOrderMessage: vi.fn(async (_order_id: string, text: string) => ({
    id: `message-${text}`,
    text,
    sender_id: profile.id,
    created_at: paid.created_at,
  })),
  verifyCheckout: vi.fn(async () => ({ ok: true })),
  payoutBanks: vi.fn(async () => [
    { name: "Example Bank", code: "058" },
    { name: "Example Bank Duplicate", code: "058" },
  ]),
  resolvePayoutName: vi.fn(async () => ({ account_name: "Tolu Ade" })),
  savePayout: vi.fn(async () => {
    profile.payout_name = "Tolu Ade";
    return { name: "Tolu Ade" };
  }),
}));
vi.mock("@/lib/payment-receipt-pdf", () => ({
  downloadPaymentReceipt: vi.fn(),
}));
vi.mock("@/lib/navigation", () => ({ navigateTo: vi.fn() }));
function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}
async function viewFirst() {
  fireEvent.click((await screen.findAllByRole("button", { name: "View item" }))[0]!);
  return within(await screen.findByRole("dialog", { name: paid.title }));
}
beforeEach(async () => {
  state.signedIn = false;
  profile.phone = "+2348012345678";
  profile.payout_name = null;
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  const api = await import("@/lib/api");
  vi.mocked(api.findItem)
    .mockReset()
    .mockImplementation(
      async (id: string) => [...items, owned].find((item) => item.id === id) || null,
    );
  vi.mocked(api.commerceSettings)
    .mockReset()
    .mockResolvedValue({ protected_checkout: false, test_payments: false });
  vi.mocked(api.getDashboard)
    .mockReset()
    .mockResolvedValue({ profile, listings: [owned] });
  vi.mocked(api.buyItem).mockReset();
  vi.mocked(api.createTestPayment).mockReset().mockResolvedValue({
    url: "https://checkout.paystack.com/test-session",
    reference: "dg-order-00000000-0000-4000-8000-000000000001",
    status: "test_pending_payment",
  });
  vi.mocked(api.verifyCheckout).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(api.getOrderMessages).mockReset().mockResolvedValue([]);
  vi.mocked(api.sendOrderMessage)
    .mockReset()
    .mockImplementation(async (_order_id: string, text: string) => ({
      id: `message-${text}`,
      text,
      sender_id: profile.id,
      created_at: paid.created_at,
    }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("Browsing, cart and separate checkout", () => {
  it("opens one scrollable item dialog with a working photo carousel", async () => {
    const router = open("/");
    const dialog = await viewFirst();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(router.state.location.pathname).toBe("/");
    fireEvent.click(dialog.getByRole("button", { name: "Next photo" }));
    expect(dialog.getByAltText("Fabric Sofa — photo 2")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Previous photo" }));
    expect(dialog.getByAltText("Fabric Sofa — photo 1")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Available right now" })).toBeInTheDocument();
  });
  it("adds free and paid items to a persistent cart and prevents duplicates", async () => {
    open("/");
    const dialog = await viewFirst();
    const add = dialog.getByRole("button", { name: "Add to cart" });
    await waitFor(() => expect(add).toBeEnabled());
    fireEvent.click(add);
    expect(readCartIds()).toEqual([paid.id]);
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    const cards = await screen.findAllByRole("article");
    const addFree = within(cards[2]!).getByRole("button", { name: "Add to cart" });
    fireEvent.click(addFree);
    expect(readCartIds()).toEqual([paid.id, free.id]);
    expect(within(cards[0]!).getByRole("button", { name: "In cart" })).toBeDisabled();
    fireEvent.click(screen.getByRole("link", { name: "View cart (2 items)" }));
    await screen.findByRole("heading", { name: /Your cart/ });
    expect(screen.getByRole("button", { name: paid.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: free.title })).toBeInTheDocument();
    cleanup();
    open("/cart");
    await screen.findByRole("heading", { name: /Your cart/ });
    expect(screen.getByRole("button", { name: paid.title })).toBeInTheDocument();
  });
  it("checks out all selected items on a page with no dialog, using fresh totals", async () => {
    state.signedIn = true;
    localStorage.setItem("doinggood.cart.v1", JSON.stringify([paid.id, second.id, free.id]));
    const api = await import("@/lib/api");
    const router = open("/cart");
    fireEvent.click(await screen.findByRole("link", { name: "Continue to checkout" }));
    await screen.findByRole("heading", { name: "Checkout" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/checkout");
    expect(screen.getByRole("heading", { name: "Your items (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay ₦50,000/ })).toBeDisabled();
    expect(screen.getByText(paid.title)).toBeInTheDocument();
    expect(screen.getByText(second.title)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: free.title })).toBeInTheDocument();
    expect(readCartIds()).toEqual([paid.id, second.id, free.id]);
    expect(api.buyItem).not.toHaveBeenCalled();
    expect(api.verifyCheckout).not.toHaveBeenCalled();
  });
  it("uses a normal sign-in page before Buy now, without a second popup", async () => {
    const router = open("/");
    const dialog = await viewFirst();
    const buy = dialog.getByRole("button", { name: "Buy now" });
    await waitFor(() => expect(buy).toBeEnabled());
    fireEvent.click(buy);
    await screen.findByRole("heading", { name: "Welcome back" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/auth");
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "A long enough password!" },
    });
    fireEvent.click(within(screen.getByRole("main")).getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Checkout" });
    expect(router.state.location.pathname).toBe(`/checkout/${paid.id}`);
  });
  it("allows signed-in users to contact free-item donors without paying a subscription", async () => {
    state.signedIn = true;
    open(`/items/${free.id}`);
    const dialog = within(await screen.findByRole("dialog", { name: free.title }));
    const contact = await dialog.findByRole("link", { name: "Contact donor" });
    expect(new URL(contact.getAttribute("href")!).hostname).toBe("wa.me");
    expect(dialog.queryByText(/membership/i)).not.toBeInTheDocument();
  });
  it("removes unavailable cart entries before allowing checkout", async () => {
    localStorage.setItem("doinggood.cart.v1", JSON.stringify(["missing-item"]));
    open("/cart");
    await screen.findByText(/This listing is no longer available/);
    expect(screen.getByRole("button", { name: "Review your cart" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove unavailable item" }));
    await screen.findByRole("heading", { name: "Your cart is ready for something good." });
    expect(readCartIds()).toEqual([]);
  });
  it("allows removing one selected item without clearing the rest", async () => {
    localStorage.setItem("doinggood.cart.v1", JSON.stringify([paid.id, second.id]));
    open("/cart");
    fireEvent.click(await screen.findByRole("button", { name: `Remove ${paid.title}` }));
    expect(readCartIds()).toEqual([second.id]);
    expect(screen.queryByRole("button", { name: paid.title })).not.toBeInTheDocument();
  });
  it("does not let a seller purchase their own listing", async () => {
    state.signedIn = true;
    open(`/items/${owned.id}`);
    const dialog = within(await screen.findByRole("dialog", { name: owned.title }));
    await dialog.findByRole("button", { name: "Add payments" });
    expect(dialog.queryByRole("button", { name: "Buy now" })).not.toBeInTheDocument();
  });
  it("keeps payment details inline on a seller's listing", async () => {
    state.signedIn = true;
    const router = open("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Add payments" }));
    await screen.findByRole("alert");
    expect(screen.queryByLabelText("Account number")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/dashboard");
  });
  it("shows a clearly marked local test payout preview without saving it", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    open("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Use test payout account" }));
    const testNotice = await screen.findByText("TEST ONLY: Local payout preview active.");
    expect(testNotice.parentElement).toHaveAttribute("role", "status");
    expect(screen.getByText("This is not saved and cannot receive payouts.")).toBeInTheDocument();
    expect(api.payoutBanks).not.toHaveBeenCalled();
    expect(api.savePayout).not.toHaveBeenCalled();
  });
  it("allows retrying a bank lookup after the provider rate limit clears", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.commerceSettings).mockResolvedValue({ protected_checkout: true });
    vi.mocked(api.resolvePayoutName).mockRejectedValueOnce(
      new Error("Bank verification is rate-limited. Please try again in 1 seconds."),
    );
    open("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Add payments" }));
    fireEvent.change(await screen.findByLabelText("Bank"), { target: { value: "058" } });
    fireEvent.change(screen.getByLabelText("Account number"), {
      target: { value: "1111111111" },
    });
    await screen.findByText(/Bank verification is rate-limited/);
    fireEvent.click(screen.getByRole("button", { name: "Retry account lookup" }));
    await screen.findByText("Account name: Tolu Ade");
    expect(api.resolvePayoutName).toHaveBeenCalledTimes(2);
  });
  it("deduplicates repeated bank codes in the payout selector", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.commerceSettings).mockResolvedValue({ protected_checkout: true });
    open("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Add payments" }));
    const bankSelect = await screen.findByLabelText("Bank");
    await waitFor(() => expect(bankSelect.querySelectorAll("option")).toHaveLength(2));
    expect(bankSelect.querySelectorAll('option[value="058"]')).toHaveLength(1);
  });
  it("can save verified payment details without opening a dialog", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.commerceSettings).mockResolvedValue({ protected_checkout: true });
    open("/dashboard");
    fireEvent.click(await screen.findByRole("button", { name: "Add payments" }));
    fireEvent.change(await screen.findByLabelText("Bank"), { target: { value: "058" } });
    fireEvent.change(screen.getByLabelText("Account number"), { target: { value: "1111111111" } });
    await screen.findByText("Account name: Tolu Ade");
    fireEvent.click(screen.getByRole("button", { name: "Verify and save payment details" }));
    await screen.findByText("Payout account: Tolu Ade");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("shows provider failures without clearing the cart or faking a receipt", async () => {
    state.signedIn = true;
    localStorage.setItem("doinggood.cart.v1", JSON.stringify([paid.id]));
    const api = await import("@/lib/api");
    vi.mocked(api.commerceSettings).mockResolvedValue({ protected_checkout: true });
    vi.mocked(api.buyItem).mockRejectedValueOnce(new Error("Payment provider unavailable."));
    open("/checkout");
    fireEvent.click(await screen.findByRole("button", { name: /^Pay/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Payment provider unavailable.");
    expect(readCartIds()).toEqual([paid.id]);
    expect(screen.getByRole("heading", { name: "Checkout" })).toBeInTheDocument();
  });
  it("sends a buyer through Paystack's clearly marked test checkout", async () => {
    state.signedIn = true;
    localStorage.setItem("doinggood.cart.v1", JSON.stringify([paid.id]));
    const api = await import("@/lib/api");
    const navigation = await import("@/lib/navigation");
    vi.mocked(api.commerceSettings).mockResolvedValue({
      protected_checkout: false,
      test_payments: true,
    });
    open("/checkout");
    expect(await screen.findByText(/TEST ONLY: Continue through Paystack/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pay/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Run test payment" }));
    await waitFor(() => expect(api.createTestPayment).toHaveBeenCalledWith(paid.id, "pickup"));
    expect(api.createTestPayment).toHaveBeenCalledWith(paid.id, "pickup");
    expect(navigation.navigateTo).toHaveBeenCalledWith(
      "https://checkout.paystack.com/test-session",
    );
    expect(api.buyItem).not.toHaveBeenCalled();
    expect(readCartIds()).toEqual([paid.id]);
    expect(
      sessionStorage.getItem(
        "doinggood.pending-payment.dg-order-00000000-0000-4000-8000-000000000001",
      ),
    ).toContain(profile.id);
  });
  it("confirms the sandbox return as TEST ONLY", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.verifyCheckout).mockResolvedValue({ ok: true, test_mode: true });
    open("/payment/return?reference=dg-order-00000000-0000-4000-8000-000000000001");
    expect(
      await screen.findByRole("heading", { name: "Test payment confirmed" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Payment confirmed\. Download your PDF receipt below/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View orders" })).toHaveAttribute("href", "/orders");
  });
  it("shows the verified payment receipt after checkout", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    const receiptPdf = await import("@/lib/payment-receipt-pdf");
    open("/payment/return?reference=order-reference");
    const download = await screen.findByRole("button", { name: "Download PDF receipt" });
    expect(screen.queryByRole("region", { name: "Payment receipt" })).not.toBeInTheDocument();
    fireEvent.click(download);
    await waitFor(() =>
      expect(receiptPdf.downloadPaymentReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: "order-reference",
          paid_amount: paid.price_kobo + 250000,
        }),
      ),
    );
    expect(api.verifyCheckout).toHaveBeenCalledWith("order-reference");
  });
  it("filters free and paid items without navigating away", async () => {
    open("/");
    await screen.findByRole("button", { name: paid.title });
    fireEvent.click(screen.getByRole("button", { name: "Free items" }));
    expect(screen.queryByRole("button", { name: paid.title })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: free.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Paid items" }));
    expect(screen.getByRole("button", { name: paid.title })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: free.title })).not.toBeInTheDocument();
  });
  it("lets users search listings", async () => {
    open("/");
    fireEvent.change(await screen.findByLabelText("Search items"), {
      target: { value: "no match" },
    });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });
  it("uses a page for account creation and WhatsApp onboarding", async () => {
    profile.phone = "";
    open("/auth");
    fireEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: profile.full_name } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "A long enough password!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "A long enough password!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(await screen.findByLabelText("WhatsApp number"), {
      target: { value: "+2348012345678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    await screen.findByRole("heading", { name: "Hello, Tolu." });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps the password recovery flow available on a page", async () => {
    open("/auth");
    fireEvent.click(await screen.findByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: profile.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await screen.findByText(
      "If an account exists for this email, a password reset link has been sent.",
    );
  });
  it("keeps order history private", async () => {
    const router = open("/orders");
    await waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
  });
  it("makes a payment receipt available in order history", async () => {
    state.signedIn = true;
    const receiptPdf = await import("@/lib/payment-receipt-pdf");
    open("/orders");
    fireEvent.click(await screen.findByRole("button", { name: "Download PDF receipt" }));
    await waitFor(() =>
      expect(receiptPdf.downloadPaymentReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          reference: "order-reference",
          paid_amount: paid.price_kobo + 250000,
        }),
      ),
    );
  });
  it("shows order history with WhatsApp links for the seller and giver", async () => {
    state.signedIn = true;
    open("/orders");
    await screen.findByRole("heading", { name: "Order history" });
    expect(screen.getByRole("link", { name: "Message seller" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/2348098765432?"),
    );
    expect(screen.getByRole("link", { name: "Message giver" })).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/2348012345678?"),
    );
    expect(screen.queryByRole("link", { name: /membership/i })).not.toBeInTheDocument();
  });
  it("lets the buyer and seller message each other inside the order", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.getOrderMessages).mockResolvedValue([
      {
        id: "message-1",
        text: "On my way to Yaba.",
        sender_id: paid.owner_id,
        created_at: paid.created_at,
      },
    ]);
    open("/orders");
    await screen.findByRole("heading", { name: "Order history" });
    fireEvent.click(screen.getByRole("button", { name: "Messages" }));
    expect(await screen.findByText(/On my way to Yaba\./)).toBeInTheDocument();
    expect(screen.getByText(/Ada:/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "See you at the gate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() =>
      expect(api.sendOrderMessage).toHaveBeenCalledWith("order-1", "See you at the gate"),
    );
    expect(await screen.findByText(/See you at the gate/)).toBeInTheDocument();
    expect(screen.getByText(/You:/)).toBeInTheDocument();
  });
  it("labels simulated purchases as test-only in order history", async () => {
    state.signedIn = true;
    const api = await import("@/lib/api");
    vi.mocked(api.getOrderHistory).mockResolvedValue({
      user_id: profile.id,
      orders: [
        {
          id: "test-order",
          item_id: paid.id,
          title: paid.title,
          amount: paid.price_kobo,
          buyer_id: profile.id,
          seller_id: paid.owner_id,
          buyer: profile.full_name,
          seller: "Ada",
          status: "test_paid",
          test_mode: true,
          reference: "dg-test-order",
          created_at: paid.created_at,
          contact: "",
        },
      ],
    });
    open("/orders");
    expect(await screen.findByText("TEST ONLY · No payment was taken")).toBeInTheDocument();
    expect(screen.getByText(/test paid/i)).toBeInTheDocument();
  });
});
