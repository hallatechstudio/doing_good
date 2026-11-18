import { useState } from "react";
import { Link, redirect, useLoaderData, useRevalidator } from "react-router-dom";
import { CheckCircle2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currentUser, getOrderHistory, updateHeldOrder, type OrderHistoryEntry } from "@/lib/api";
import { itemPrice } from "@/lib/site";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export async function orderHistoryLoader() {
  if (!(await currentUser())) throw redirect("/auth?next=%2Forders");
  return getOrderHistory();
}

function MessageContact({
  phone,
  label,
  message,
}: {
  phone: string | null;
  label: string;
  message: string;
}) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  return (
    <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
      <a
        href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <WhatsAppIcon className="size-5" />
        {label}
      </a>
    </Button>
  );
}

function HeldOrderActions({
  order,
  buying,
  selling,
}: {
  order: OrderHistoryEntry;
  buying: boolean;
  selling: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { revalidate, state } = useRevalidator();
  const reviewing = ["paid", "delivery_pending", "delivered"].includes(order.status);
  const canDispute = reviewing && (!order.release_at || Date.parse(order.release_at) > Date.now());
  const reportDelivery = selling && order.status === "paid";
  const disabled = busy || state !== "idle";
  async function update(action: "deliver" | "confirm") {
    if (disabled) return;
    setBusy(true);
    try {
      await updateHeldOrder(order.id, action, "");
      await revalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the order.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      {order.status === "disputed" && (
        <p role="status">Payment held while support reviews the dispute.</p>
      )}
      {order.status === "delivered" && order.release_at && (
        <p className="text-sm text-muted-foreground">
          Delivery reported. The review window ends{" "}
          {new Date(order.release_at).toLocaleString("en-NG")}.
        </p>
      )}
      {buying &&
        order.accountability_until &&
        Date.parse(order.accountability_until) > Date.now() && (
          <p className="text-sm text-muted-foreground">
            Payment released. The accountability window ends{" "}
            {new Date(order.accountability_until).toLocaleString("en-NG")}.
          </p>
        )}
      {buying && reviewing && (
        <Button onClick={() => setConfirmOpen(true)} disabled={disabled}>
          Confirm and release payment
        </Button>
      )}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogTitle>Release payment to the giver?</DialogTitle>
          <DialogDescription className="mt-3 leading-6">
            Confirm only after you have received and checked this item. Payment will be released to
            the giver’s DoingGood wallet and this action cannot be undone here.
          </DialogDescription>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={disabled}>
              Not yet
            </Button>
            <Button
              variant="hero"
              disabled={disabled}
              onClick={async () => {
                await update("confirm");
                setConfirmOpen(false);
              }}
            >
              {busy ? "Releasing…" : "Yes, release payment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {reportDelivery && (
        <Button type="button" variant="outline" disabled={disabled} onClick={() => void update("deliver")}>
          Mark delivered
        </Button>
      )}
      {buying && canDispute && (
        <Button asChild variant="outline">
          <a
            href={`mailto:support@hallatechnologies.com?subject=${encodeURIComponent(`Delivery dispute: ${order.title}`)}&body=${encodeURIComponent(`Order: ${order.title}\n\nPlease describe what happened:\n\n`)}`}
          >
            Dispute delivery by email
          </a>
        </Button>
      )}
    </div>
  );
}

/* In-app chat is intentionally not used. Handover conversations happen in WhatsApp. */
/*function OrderMessages({ order, user_id }: { order: OrderHistoryEntry; user_id: string }) {
  const buying = order.buyer_id === user_id;
  const other = buying ? order.seller : order.buyer;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setBusy(true);
    try {
      setMessages(await getOrderMessages(order.id));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load messages.");
    } finally {
      setBusy(false);
    }
  }
  async function send(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const sent = await sendOrderMessage(order.id, text);
      setMessages((current) => [...current, sent]);
      setDraft("");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
      >
        <WhatsAppIcon className="size-5" />
        {open ? "Hide conversation" : "Open conversation"}
      </Button>
      {open && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {!messages.length && !busy && !error && (
            <p className="text-sm text-muted-foreground">
              No messages yet. Say hello to {other} to arrange the {order.fulfillment_method === "delivery" ? "delivery" : "pickup"}.
            </p>
          )}
          {messages.map((message) => (
            <p key={message.id} className="text-sm">
              <span className="font-semibold">
                {message.sender_id === user_id ? "You" : other}:
              </span>{" "}
              {message.text}
            </p>
          ))}
          <form className="space-y-2" onSubmit={send}>
            <Textarea
              aria-label="Message"
              required
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={busy}
            />
            <Button type="submit" disabled={busy || !draft.trim()}>
              {busy ? "Sending…" : "Send message"}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}*/

function orderStage(order: OrderHistoryEntry, buying: boolean) {
  switch (order.status) {
    case "pending_payment":
      return {
        label: "Payment pending",
        detail: "Complete payment to reserve this item and contact the other person.",
      };
    case "paid":
      return {
        label: "Payment held",
        detail: buying
          ? "Message the giver to arrange pickup or delivery."
          : "Message the receiver to arrange pickup or delivery, then confirm delivery.",
      };
    case "delivery_pending":
      return { label: "Delivery being reported", detail: "The delivery review is being prepared." };
    case "delivered":
      return {
        label: "Delivery under review",
        detail: buying
          ? "Confirm receipt when the item arrives, or dispute delivery before the deadline."
          : "The receiver has 24 hours to confirm receipt or raise a dispute.",
      };
    case "disputed":
      return {
        label: "Delivery disputed",
        detail: "Payment remains held while the issue is reviewed.",
      };
    case "release_pending":
    case "payout_processing":
      return { label: "Payment releasing", detail: "The payment release is being processed." };
    case "released":
      return {
        label: "Payment released",
        detail: buying
          ? "The giver has been paid. Use the accountability window if you need to report a problem."
          : order.wallet_release
            ? "The payment has been released to your DoingGood wallet."
            : "The payment was sent directly to your verified bank account.",
      };
    case "refunded":
      return { label: "Refunded", detail: "The payment has been returned to the receiver." };
    default:
      return {
        label: order.status.replaceAll("_", " "),
        detail: "Use WhatsApp to arrange the next steps.",
      };
  }
}

export function OrderCard({ order, user_id }: { order: OrderHistoryEntry; user_id: string }) {
  const buying = order.buyer_id === user_id;
  const selling = order.seller_id === user_id;
  const stage = orderStage(order, buying);
  const completed = order.status === "released" || order.status === "refunded";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40">
      <div className="flex gap-4 p-5">
        {order.photo ? (
          <img src={order.photo} alt="" className="size-16 rounded-xl object-cover sm:size-20" />
        ) : (
          <div className="grid size-16 place-items-center rounded-xl bg-primary/10 text-primary sm:size-20">
            <PackageCheck className="size-7" />
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {buying ? "Your requested item" : selling ? "Your given item" : "Item"}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString("en-NG")}
            </span>
          </div>
          <Link
            className="block truncate text-lg font-bold hover:text-primary"
            to={`/items/${order.item_id}`}
          >
            {order.title}
          </Link>
          <p className="text-sm text-muted-foreground">
            {buying
              ? `Giver: ${order.seller}`
              : selling
                ? `Receiver: ${order.buyer}`
                : `${order.buyer} · ${order.seller}`}
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col space-y-4 border-t border-border px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{stage.label}</p>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{stage.detail}</p>
          </div>
          <p className="whitespace-nowrap text-lg font-bold text-primary">
            {itemPrice(order.amount)}
          </p>
        </div>
        {completed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" aria-label="Completed" />
            Completed
          </div>
        )}
        {buying && order.status === "pending_payment" && (
          <Button asChild variant="hero">
            <Link to={`/checkout/${order.item_id}`}>Continue payment</Link>
          </Button>
        )}
        {order.held_payment && <HeldOrderActions order={order} buying={buying} selling={selling} />}
        <div className="mt-auto flex flex-wrap items-center gap-4 pt-1">
          <MessageContact
            phone={order.contact}
            label={buying ? "Message giver" : "Message receiver"}
            message={`Hi! I'm getting in touch about ${order.title} on DoingGood (order ${order.reference}).`}
          />
          <Link to={`/orders/${order.id}`} className="text-sm font-semibold text-primary hover:underline">
            View order
          </Link>
        </div>
        {buying && (order.can_track_handoff || order.status === "released") && (
          <Button asChild variant="ghost">
            <a
              href={`mailto:support@hallatechnologies.com?subject=${encodeURIComponent(`Order issue: ${order.reference}`)}>`}
            >
              Report a problem
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export function OrderHistoryPage() {
  const { user_id, orders, admin } = useLoaderData() as Awaited<
    ReturnType<typeof orderHistoryLoader>
  >;
  const purchases = orders.filter((order) => order.buyer_id === user_id);
  const sales = orders.filter((order) => order.seller_id === user_id);
  const otherOrders = orders.filter(
    (order) => order.buyer_id !== user_id && order.seller_id !== user_id,
  );
  type OrderView = "buying" | "selling" | "all";
  const [view, setView] = useState<OrderView>(purchases.length ? "buying" : "selling");
  const lists: Record<OrderView, OrderHistoryEntry[]> = {
    buying: purchases,
    selling: sales,
    all: orders,
  };
  const visible = lists[view];
  const heading: Record<OrderView, string> = {
    buying: "Items as a receiver",
    selling: "Items as a giver",
    all: "All items",
  };
  const empty: Record<OrderView, string> = {
    buying: "No received items yet.",
    selling: "No given items yet.",
    all: "No items yet.",
  };
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
      <title>Order history | DoingGood</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <h1 className="section-title">Order history</h1>
          <p className="text-muted-foreground">
            Keep every item request and giveaway in one place. Arrange handover on WhatsApp.
          </p>
        </div>
        {admin && <Link to="/admin" className="text-sm font-semibold text-primary hover:underline">Admin overview</Link>}
        <div className="flex items-center gap-2">
          <label htmlFor="order-view" className="text-sm font-medium text-muted-foreground">
            Show
          </label>
          <select
            id="order-view"
            value={view}
            onChange={(event) => setView(event.target.value as OrderView)}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="buying">Receiver</option>
            <option value="selling">Giver</option>
            {admin && otherOrders.length > 0 && <option value="all">All orders</option>}
          </select>
        </div>
      </div>
      {(purchases.length > 0 || sales.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">RECEIVER</p>
            <p className="mt-2 text-3xl font-extrabold">{purchases.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {purchases.length === 1 ? "item as receiver" : "items as receiver"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="eyebrow">GIVER</p>
            <p className="mt-2 text-3xl font-extrabold">{sales.length}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {sales.length === 1 ? "item as giver" : "items as giver"}
            </p>
          </div>
        </div>
      )}
      <section className="space-y-4">
        <div>
          <p className="eyebrow">
            {view === "buying" ? "RECEIVER" : view === "selling" ? "GIVER" : "ALL"}
          </p>
          <h2 className="text-xl font-bold">{heading[view]}</h2>
        </div>
        {visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((order) => (
              <OrderCard key={order.id} order={order} user_id={user_id} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">{empty[view]}</p>
        )}
      </section>
    </div>
  );
}
