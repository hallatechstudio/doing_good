import { useEffect, useRef, useState } from "react";
import {
  Link,
  redirect,
  useLoaderData,
  useSearchParams,
  type LoaderFunctionArgs,
} from "react-router-dom";
import { currentUser, getOrderHistory, verifyCheckout, type OrderHistoryEntry } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, PackageCheck, ShieldCheck } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { PaymentReceiptDownload } from "@/components/payment-receipt";

export async function paymentReturnLoader({ request }: LoaderFunctionArgs) {
  const profile = await currentUser();
  const url = new URL(request.url);
  if (!profile) throw redirect(`/auth?next=${encodeURIComponent(url.pathname + url.search)}`);
  return profile;
}
export function PaymentReturnPage() {
  const profile = useLoaderData() as Awaited<ReturnType<typeof paymentReturnLoader>>;
  const [params] = useSearchParams();
  const reference = params.get("reference") || params.get("trxref") || "";
  const [status, setStatus] = useState("Verifying your payment…");
  const [success, setSuccess] = useState(false);
  const [receipt, setReceipt] = useState<OrderHistoryEntry | null>(null);
  const [seller, setSeller] = useState<{ phone: string; title: string } | null>(null);
  const attempted = useRef("");
  const { removeMany } = useCart();
  useEffect(() => {
    if (!reference) {
      setStatus("No payment reference was supplied.");
      return;
    }
    if (attempted.current === reference) return;
    attempted.current = reference;
    void verifyCheckout(reference)
      .then(async () => {
        try {
          const key = `doinggood.pending-payment.${reference}`;
          const pending = JSON.parse(sessionStorage.getItem(key) || "null") as {
            buyer_id: string;
            ids: string[];
          } | null;
          if (pending?.buyer_id === profile.id && Array.isArray(pending.ids)) {
            removeMany(pending.ids);
            sessionStorage.removeItem(key);
          }
        } catch {
          /* A verified payment remains valid if browser storage is unavailable. */
        }
        setSuccess(true);
        try {
          const order = (await getOrderHistory()).orders.find(
            (entry) => entry.reference === reference,
          );
          if (order) setReceipt(order);
          if (order?.contact) setSeller({ phone: order.contact, title: order.title });
          setStatus(
            order
              ? "Payment confirmed. Download your PDF receipt below, or open Order history later."
              : "Payment confirmed. Your receipt will be available to download in Order history.",
          );
        } catch {
          setStatus(
            "Payment confirmed. Your receipt will be available to download in Order history shortly.",
          );
        }
      })
      .catch((error: unknown) =>
        setStatus(
          error instanceof Error
            ? error.message
            : "Payment verification is pending. Refresh to try again.",
        ),
      );
  }, [reference, profile.id, removeMany]);
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:py-20">
      <title>Payment confirmation | DoingGood</title>
      <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
        <div className={success ? "bg-primary/10 px-6 py-8 sm:px-10" : "px-6 py-8 sm:px-10"}>
          <div className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
            {success ? (
              <CheckCircle2 className="size-7" />
            ) : (
              <Clock3 className="size-7 animate-pulse" />
            )}
          </div>
          <p className="eyebrow mt-6">{success ? "PAYMENT SUCCESSFUL" : "PAYMENT CHECK"}</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            {success ? "You’re all set." : "Checking your payment"}
          </h1>
          <p role="status" className="mt-3 max-w-lg leading-7 text-muted-foreground">
            {status}
          </p>
        </div>
        {success && (
          <div className="space-y-6 px-6 py-8 sm:px-10">
            {receipt ? (
              <div className="space-y-2">
                <PaymentReceiptDownload order={receipt} />
                <p className="text-sm text-muted-foreground">
                  Your PDF includes the verified amount, order breakdown, date, and payment
                  reference.
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-border bg-background p-4 text-sm text-muted-foreground">
                Your receipt will be available to download from Order history.
              </p>
            )}
            <div className="flex gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-sm leading-6">
                We only release payment to the giver after you confirm you have received the item.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <p className="font-bold">What happens next</p>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span><span>Message the giver to agree on pickup or delivery.</span></li>
                <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span><span>Check the item when you receive it.</span></li>
                <li className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span><span>Confirm receipt, then release payment from Order history.</span></li>
              </ol>
            </div>
            {seller && (
              <Button
                asChild
                size="lg"
                className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/${seller.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi, I just made a payment for ${seller.title} on DoingGood. Can we arrange pickup or delivery?`)}`}
                >
                  <WhatsAppIcon className="size-5" />
                  Message giver
                </a>
              </Button>
            )}
            <Button asChild variant="outline" className="w-full">
              <Link to="/orders">
                <PackageCheck className="size-4" />
                View orders
              </Link>
            </Button>
          </div>
        )}
        {!success && (
          <div className="flex flex-wrap gap-3 border-t border-border px-6 py-6 sm:px-10">
            <Button asChild>
              <Link to="/cart">View cart</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Browse items</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
