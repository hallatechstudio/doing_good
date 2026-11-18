import { useState } from "react";
import { Link, redirect, useLoaderData, type LoaderFunctionArgs } from "react-router-dom";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { navigateTo } from "@/lib/navigation";
import {
  buyItem,
  commerceSettings,
  createTestPayment,
  currentUser,
  findItem,
  getOrderHistory,
  saveGiverContact,
  updateProfile,
} from "@/lib/api";
import { readCartIds } from "@/lib/cart";
import { appUrl, itemPrice } from "@/lib/site";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export async function checkoutLoader({ params, request }: LoaderFunctionArgs) {
  const ids = params["id"] ? [params["id"]] : readCartIds();
  if (!ids.length) throw redirect("/cart");
  const profile = await currentUser();
  const url = new URL(request.url);
  if (!profile) throw redirect(`/auth?next=${encodeURIComponent(url.pathname + url.search)}`);
  const found = await Promise.all(ids.map((id) => findItem(id)));
  if (found.some((item) => !item))
    throw new Error(
      "Some items are no longer available. Return to your cart to review your selection.",
    );
  const items = found.filter((item) => item !== null);
  if (items.some((item) => item.owner_id === profile.id))
    throw new Error(
      "Your selection contains your own listing. Remove it from your cart before checkout.",
    );
  const settings = await commerceSettings().catch(() => ({
    protected_checkout: false,
    test_payments: false,
  }));
  const reserved = items.find((item) => item.price_kobo && item.status === "reserved");
  const pending = reserved
    ? (await getOrderHistory()).orders.find(
        (order) =>
          order.item_id === reserved.id &&
          order.buyer_id === profile.id &&
          order.status === "pending_payment",
      )
    : undefined;
  return {
    items,
    profile,
    available: settings.protected_checkout,
    testPayments: settings.test_payments === true,
    pending,
  };
}
export function CheckoutPage() {
  const { items, profile, available, testPayments, pending } = useLoaderData() as Awaited<
    ReturnType<typeof checkoutLoader>
  >;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const needsPhone = !/^\+[1-9]\d{7,14}$/.test(profile.phone);
  const formattedPhone = phone.trim().replace(/[\s()-]/g, "");
  const contactReady = !needsPhone || /^\+[1-9]\d{7,14}$/.test(formattedPhone);
  const [selection, setSelection] = useState<{ itemId: string; method: "pickup" | "delivery" }>();
  const paid = items.filter((item) => (item.price_kobo || 0) > 0);
  const free = items.filter((item) => !item.price_kobo);
  const listing = paid.length === 1 ? paid[0] : undefined;
  const pickup = listing?.pickup_available !== false;
  const delivery = listing?.delivery_fee_kobo != null;
  const method =
    pending?.fulfillment_method ??
    (listing && selection?.itemId === listing.id
      ? selection.method
      : pickup
        ? "pickup"
        : "delivery");
  const fee =
    method === "delivery" ? (pending?.delivery_fee_kobo ?? listing?.delivery_fee_kobo ?? 0) : 0;
  const subtotal = paid.reduce((sum, item) => sum + item.price_kobo!, 0);
  const total = subtotal + fee;
  const liveSupported = available && paid.length === 1;
  const allAvailable = items.every(
    (item) => item.status === "available" || (pending && item.id === pending.item_id),
  );
  const testSupported =
    testPayments && paid.length === 1 && listing?.status === "available" && allAvailable;
  async function pay() {
    if (busy || !allAvailable || !liveSupported || !contactReady) return;
    setBusy(true);
    setError("");
    try {
      if (needsPhone) await updateProfile(formattedPhone);
      const checkout = await buyItem(paid[0]!.id, method);
      sessionStorage.setItem(
        `doinggood.pending-payment.${checkout.reference}`,
        JSON.stringify({ buyer_id: profile.id, ids: paid.map((item) => item.id) }),
      );
      window.location.assign(checkout.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Payment could not be started. Please try again.",
      );
      setBusy(false);
    }
  }
  async function runTestPayment() {
    if (busy || !testSupported || !listing) return;
    setBusy(true);
    setError("");
    try {
      const result = await createTestPayment(listing.id, method);
      sessionStorage.setItem(
        `doinggood.pending-payment.${result.reference}`,
        JSON.stringify({ buyer_id: profile.id, ids: paid.map((item) => item.id) }),
      );
      navigateTo(result.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Test payment could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <title>Checkout | DoingGood</title>
      <Link to="/cart" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" />
        Review your cart
      </Link>
      <h1 className="section-title mt-6">Checkout</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Review your selection and continue. No extra pop-up is needed.
      </p>
      <div className="mt-8 grid items-start gap-6 md:grid-cols-[1.2fr_1fr]">
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Your items ({items.length})</h2>
          {items.map((item) => (
            <article
              key={item.id}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <img
                src={item.photos[0] || "/images/sofa.jpg"}
                alt={item.title}
                className="size-20 rounded-lg object-cover"
              />
              <div>
                <h3 className="font-bold">{item.title}</h3>
                <p className="mt-2 font-bold text-primary">{itemPrice(item.price_kobo)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.donor_name || "DoingGood neighbour"} · {item.location}
                </p>
                {item.status === "reserved" && (
                  <p className="mt-2 text-sm text-muted-foreground">Reserved</p>
                )}
                {item.status !== "available" && item.status !== "reserved" && (
                  <p className="mt-2 text-sm text-muted-foreground">No longer available</p>
                )}
              </div>
            </article>
          ))}
          {free.length > 0 && (
            <div id="collection" className="space-y-3 rounded-xl border border-border p-5">
              <h2 className="font-bold">Arrange collection for free items</h2>
              <p className="text-xs leading-6 text-muted-foreground">
                These items have no amount. Contact each giver to confirm availability and
                collection.
              </p>
              {free.map((item) => {
                const digits = item.donor_whatsapp.replace(/\D/g, "");
                const text = `Hi! I'm interested in ${item.title} on DoingGood. Is it still available? ${appUrl}/items/${item.id}`;
                return (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm">{item.title}</span>
                    {/^[1-9]\d{7,14}$/.test(digits) ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
                          onClick={() =>
                            void saveGiverContact(item.id).catch(() => {
                              toast.error("Could not save this contact to your order history.");
                            })
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Contact donor
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Contact currently unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="space-y-5 rounded-xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold">Payment summary</h2>
          {listing && (
            <fieldset disabled={busy || Boolean(pending)} className="space-y-2 text-sm">
              <legend className="mb-2 font-semibold">How will you get your item?</legend>
              {pickup && (
                <label className="flex gap-2">
                  <input
                    type="radio"
                    name="handoff"
                    checked={method === "pickup"}
                    onChange={() => setSelection({ itemId: listing.id, method: "pickup" })}
                  />
                  Pickup in {listing.location} · Free
                </label>
              )}
              {delivery && (
                <label className="flex gap-2">
                  <input
                    type="radio"
                    name="handoff"
                    checked={method === "delivery"}
                    onChange={() => setSelection({ itemId: listing.id, method: "delivery" })}
                  />
                  Delivery to {listing.delivery_area} · {itemPrice(listing.delivery_fee_kobo!)}
                </label>
              )}
            </fieldset>
          )}
          <dl className="space-y-4 text-sm">
            <div className="flex justify-between">
              <dt>Selected items</dt>
              <dd>{items.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Item subtotal</dt>
              <dd>{itemPrice(subtotal)}</dd>
            </div>
            {method === "delivery" && (
              <div className="flex justify-between">
                <dt>Delivery fee</dt>
                <dd>{itemPrice(fee)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Platform fee</dt>
              <dd>₦0.00</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-4 text-xl font-bold">
              <dt>Total</dt>
              <dd className="text-primary">{itemPrice(total)}</dd>
            </div>
          </dl>
          <p className="text-xs leading-6 text-muted-foreground">
            Signed in as {profile.full_name}.{" "}
            {listing &&
              (method === "delivery"
                ? "Check that your address is in the giver’s delivery area. Share it privately after payment."
                : "Message the giver after paying to arrange the pickup time and address.")}
          </p>
          {!liveSupported && paid.length > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Online payment for this selection is not available yet. Please return when checkout is
              ready.
            </p>
          )}
          {testPayments && paid.length > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              TEST ONLY: Continue through Paystack’s test checkout. No real money will be charged.
              {paid.length > 1 && " Test checkout supports one paid item at a time."}
            </p>
          )}
          {!allAvailable && (
            <p role="status" className="text-sm text-muted-foreground">
              Remove unavailable items from your cart before continuing.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {listing && needsPhone && (
            <div className="space-y-2">
              <Label htmlFor="buyer-whatsapp">Your WhatsApp number</Label>
              <Input
                id="buyer-whatsapp"
                type="tel"
                autoComplete="tel"
                placeholder="+2348012345678"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Include the country code. We save this to your profile and share it with the giver
                after payment.
              </p>
            </div>
          )}
          {paid.length > 0 ? (
            <div className="space-y-3">
              <Button
                variant="hero"
                size="lg"
                className="w-full"
                onClick={pay}
                disabled={busy || !allAvailable || !liveSupported || !contactReady}
              >
                <LockKeyhole className="size-4" />
                {busy ? "Processing…" : `Get item · ${itemPrice(total)}`}
              </Button>
              {testPayments && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  onClick={runTestPayment}
                  disabled={busy || !testSupported}
                >
                  {busy ? "Processing…" : "Run test payment"}
                </Button>
              )}
            </div>
          ) : (
            <Button asChild variant="hero" className="w-full">
              <a href="#collection">Arrange collection</a>
            </Button>
          )}
          {paid.length > 0 && (
            <p className="flex gap-2 text-xs leading-6 text-muted-foreground">
              <ShieldCheck className="mt-1 size-4 shrink-0" />
              {liveSupported
                ? "Complete payment through the payment provider."
                : "Test transactions are confirmed by Paystack but never charge real money or pay givers."}
            </p>
          )}
          <Link to="/terms" className="inline-block text-xs text-primary underline">
            Payment and delivery terms
          </Link>
        </section>
      </div>
    </div>
  );
}
