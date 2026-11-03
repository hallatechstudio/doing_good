import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useRevalidator, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MembershipButton } from "@/components/membership";
import {
  buyItem,
  getOrders,
  orderAction,
  payoutBanks,
  savePayout,
  verifyCheckout,
  type Order,
} from "@/lib/api";
import { itemPrice } from "@/lib/site";

const statuses: Record<string, string> = {
  payment_expired: "Checkout expired — item reservation released",
  pending_payment: "Awaiting payment",
  paid: "Paid — awaiting delivery",
  delivery_pending: "Delivery reported — notifying buyer",
  delivered: "Delivery review — 24 hours",
  disputed: "Disputed — payout frozen",
  release_pending: "Payout queued",
  payout_processing: "Payout processing",
  released: "Seller paid",
  payout_review: "Payout needs support review",
  refund_pending: "Refund queued",
  refund_processing: "Refund processing",
  refunded: "Refund completed",
  refund_review: "Refund needs support review",
};
function OrderCard({
  order,
  userId,
  admin,
  refresh,
}: {
  order: Order;
  userId: string;
  admin: boolean;
  refresh: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const buyer = userId === order.buyer_id;
  const seller = userId === order.seller_id;
  const reviewOpen = ["paid", "delivery_pending", "delivered"].includes(order.status);
  async function act(action: string, data: unknown = {}) {
    if (
      action === "confirm" &&
      !window.confirm(
        "Have you received and checked the item? Confirming will authorise payment to the seller.",
      )
    )
      return;
    setBusy(true);
    try {
      await orderAction(order.id, action, data);
      toast.success("Order updated.");
      setNote("");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update order.");
    } finally {
      setBusy(false);
    }
  }
  async function resume() {
    setBusy(true);
    try {
      const checkout = await buyItem(order.item_id);
      window.location.assign(checkout.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex gap-4">
        {order.photo && (
          <img src={order.photo} alt="" className="size-16 rounded-lg object-cover" />
        )}
        <div>
          <Link to={`/items/${order.item_id}`} className="text-lg font-bold hover:text-primary">
            {order.title}
          </Link>
          <p className="mt-1 font-bold text-primary">{itemPrice(order.amount)}</p>
        </div>
      </div>
      <p className="font-semibold">{statuses[order.status] || order.status}</p>
      <p className="text-sm text-muted-foreground">
        Buyer: {order.buyer} · Seller: {order.seller}
      </p>
      <p className="break-all text-xs text-muted-foreground">
        Payment reference: {order.reference}
      </p>
      {order.release_at && order.status === "delivered" && (
        <p role="status" className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
          Review by {new Date(order.release_at).toLocaleString()}. Without a dispute, payout becomes
          due at this time. Actual bank processing can take longer.
        </p>
      )}
      {order.delivery_note && (
        <p className="text-sm text-muted-foreground">Delivery report: {order.delivery_note}</p>
      )}
      {order.dispute_reason && (
        <p className="text-sm text-muted-foreground">Dispute: {order.dispute_reason}</p>
      )}
      {order.resolution_note && (
        <p className="text-sm text-muted-foreground">Review outcome: {order.resolution_note}</p>
      )}
      {order.contact && (
        <a
          href={`https://wa.me/${order.contact.replace(/\D/g, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm text-primary underline"
        >
          Discuss delivery on WhatsApp
        </a>
      )}
      {buyer && order.status === "pending_payment" && (
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={resume}>
            Continue payment
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await verifyCheckout(order.reference);
                toast.success("Payment verified.");
                refresh();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Not confirmed yet.");
              } finally {
                setBusy(false);
              }
            }}
          >
            I have paid — verify
          </Button>
        </div>
      )}
      {((buyer && reviewOpen) ||
        (seller && order.status === "paid") ||
        (admin && order.status === "disputed")) && (
        <div className="space-y-3 border-t border-border pt-4">
          <Label htmlFor={`note-${order.id}`}>
            {seller
              ? "Delivery evidence / collection details"
              : admin
                ? "Review findings and evidence"
                : "What went wrong? Include evidence or delivery details."}
          </Label>
          <Textarea
            id={`note-${order.id}`}
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Provide at least 10 characters"
          />
          <div className="flex flex-wrap gap-3">
            {seller && order.status === "paid" && (
              <Button
                disabled={busy || note.trim().length < 10}
                onClick={() => act("deliver", { note })}
              >
                Report delivered
              </Button>
            )}
            {buyer && reviewOpen && (
              <>
                <Button disabled={busy} onClick={() => act("confirm")}>
                  I received and checked my item
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || note.trim().length < 10}
                  onClick={() => act("dispute", { reason: note })}
                >
                  Open dispute — pause payout
                </Button>
              </>
            )}
            {admin && order.status === "disputed" && (
              <>
                <Button
                  disabled={busy || note.trim().length < 10}
                  onClick={() => act("resolve", { outcome: "release", note })}
                >
                  Resolve: pay seller
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || note.trim().length < 10}
                  onClick={() => act("resolve", { outcome: "refund", note })}
                >
                  Resolve: refund buyer
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {["disputed", "refund_review", "payout_review"].includes(order.status) && (
        <p className="text-sm text-muted-foreground">
          Contact{" "}
          <a href="mailto:support@bethereexperience.com" className="text-primary underline">
            support
          </a>{" "}
          with your reference. Disputed orders are not released by the 24-hour timer.
        </p>
      )}
    </article>
  );
}

function PayoutForm() {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  async function load() {
    setBusy(true);
    try {
      setBanks(await payoutBanks());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Payout setup unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await savePayout(String(form.get("bank")), String(form.get("account")));
      setName(result.name);
      toast.success("Verified payout account saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify account.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-bold">Seller payout account</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Add your Nigerian bank account before selling a paid item. We verify the account name and
        store the payment provider's recipient token. Account changes apply to future orders.
      </p>
      {name && (
        <p role="status" className="mt-4 text-primary">
          Verified: {name}
        </p>
      )}
      {!banks.length ? (
        <Button className="mt-4" variant="outline" onClick={load} disabled={busy}>
          Set up / change payout account
        </Button>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          <Label htmlFor="payout-bank">Bank</Label>
          <select
            id="payout-bank"
            name="bank"
            required
            className="h-11 w-full rounded-md border border-input bg-background px-3"
          >
            <option value="">Choose your bank</option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </select>
          <Label htmlFor="payout-number">Account number</Label>
          <Input
            id="payout-number"
            name="account"
            required
            inputMode="numeric"
            pattern="[0-9]{10}"
            minLength={10}
            maxLength={10}
            autoComplete="off"
          />
          <Button disabled={busy}>{busy ? "Verifying…" : "Verify and save account"}</Button>
        </form>
      )}
    </section>
  );
}

export function OrdersPage() {
  const data = useLoaderData() as Awaited<ReturnType<typeof getOrders>>;
  const revalidator = useRevalidator();
  const [params, setParams] = useSearchParams();
  const attempted = useRef("");
  const [message, setMessage] = useState("");
  const reference = params.get("reference") || params.get("trxref") || "";
  useEffect(() => {
    if (!reference || attempted.current === reference) return;
    attempted.current = reference;
    setMessage("Verifying your payment securely…");
    void verifyCheckout(reference)
      .then(async () => {
        setMessage("Payment verified. Your membership or order is now updated.");
        setParams({}, { replace: true });
        window.dispatchEvent(new Event("doinggood:auth"));
        await revalidator.revalidate();
      })
      .catch((error: unknown) =>
        setMessage(
          error instanceof Error
            ? error.message
            : "Payment verification is pending. Please refresh to retry.",
        ),
      );
  }, [reference, revalidator, setParams]);
  const active = Boolean(data.membership_until && new Date(data.membership_until) > new Date());
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <title>Orders and membership | DoingGood</title>
      <p className="eyebrow text-primary">Your DoingGood activity</p>
      <h1 className="section-title mt-4">Orders & membership</h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
        Track purchases and sales, review delivery and keep your membership active. Never confirm
        receipt before checking your item.
      </p>
      {message && (
        <p role="status" className="mt-6 rounded-lg border border-primary/30 p-4">
          {message}
        </p>
      )}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-xl font-bold">Free-item membership</h2>
          <p className="text-muted-foreground">
            {active
              ? `Active until ${new Date(data.membership_until!).toLocaleString()}`
              : "No active membership"}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">
            ₦20,000 for 30 days to request free items. Renew manually; no automatic charges.
            Membership does not guarantee availability, a match or delivery.
          </p>
          <MembershipButton />
        </section>
        <PayoutForm />
      </div>
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {data.admin ? "Order management" : "Purchases & sales"}
        </h2>
        <Button
          variant="outline"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state !== "idle"}
        >
          Refresh
        </Button>
      </div>
      {!data.orders.length && (
        <p className="py-12 text-center text-muted-foreground">
          No paid orders yet.{" "}
          <Link to="/" className="text-primary underline">
            Browse items
          </Link>
          .
        </p>
      )}
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
        {data.orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            userId={data.user_id}
            admin={data.admin}
            refresh={() => {
              void revalidator.revalidate();
            }}
          />
        ))}
      </div>
    </div>
  );
}
