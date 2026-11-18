import { useEffect, useState } from "react";
import { redirect, useLoaderData, useRevalidator } from "react-router-dom";
import { Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  createWithdrawal,
  currentUser,
  getWallet,
  payoutBanks,
  resolvePayoutName,
  savePayout,
} from "@/lib/api";
import { itemPrice } from "@/lib/site";

type Bank = { name: string; code: string };
const walletAmount = (kobo: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(kobo / 100);

export async function walletLoader() {
  if (!(await currentUser())) throw redirect("/auth?next=%2Fwallet");
  return getWallet();
}

export function WalletPage() {
  const wallet = useLoaderData() as Awaited<ReturnType<typeof walletLoader>>;
  const { revalidate, state } = useRevalidator();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const amountKobo = Math.round(Number(amount || 0) * 100);
  const validAmount =
    Number.isFinite(amountKobo) && amountKobo >= 100 && amountKobo <= wallet.available;

  function openWithdraw() {
    setWithdrawOpen(true);
    setError("");
    if (banks.length) return;
    setLoadingBanks(true);
    void payoutBanks()
      .then((result) => setBanks([...new Map(result.map((bank) => [bank.code, bank])).values()]))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Could not load banks."),
      )
      .finally(() => setLoadingBanks(false));
  }

  useEffect(() => {
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      setAccountName("");
      setResolving(false);
      return;
    }
    let active = true;
    setResolving(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const result = await resolvePayoutName(bankCode, accountNumber);
        if (active) setAccountName(result.account_name);
      } catch (reason) {
        if (active) {
          setAccountName("");
          setError(reason instanceof Error ? reason.message : "Could not verify this account.");
        }
      } finally {
        if (active) setResolving(false);
      }
    }, 500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [bankCode, accountNumber]);

  async function withdraw() {
    if (!accountName || !validAmount || busy) return;
    setBusy(true);
    setError("");
    try {
      await savePayout(bankCode, accountNumber);
      await createWithdrawal(amountKobo);
      setWithdrawOpen(false);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      toast.success("Your withdrawal is being sent to your bank account.");
      await revalidate();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start this withdrawal.");
    } finally {
      setBusy(false);
    }
  }

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(bankSearch.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6">
      <title>Wallet | DoingGood</title>
      <div>
        <p className="eyebrow">YOUR WALLET</p>
        <h1 className="section-title">Earnings and releases</h1>
        <p className="mt-2 text-muted-foreground">
          Released amounts are ready to withdraw after receiver confirmation or the delivery review
          period.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
          <p className="text-sm">Net payout available</p>
          <p className="mt-2 text-3xl font-extrabold">{walletAmount(wallet.available)}</p>
          <Button
            className="mt-5"
            disabled={!wallet.available || state !== "idle"}
            onClick={openWithdraw}
          >
            <Landmark className="size-4" /> Withdraw money
          </Button>
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Pending release</p>
          <p className="mt-2 text-3xl font-extrabold">{walletAmount(wallet.pending)}</p>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            This item becomes available once the receiver confirms receipt of the item, or 24 hours after you confirm delivery of the item.
          </p>
        </section>
      </div>
      <p className="text-sm text-muted-foreground">Your net payout reflects the {wallet.commission_rate}% DoingGood commission.</p>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Transactions</h2>
        {!wallet.transactions.length ? (
          <p className="text-muted-foreground">No wallet activity yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {wallet.transactions.map((transaction) => (
              <article
                key={`${transaction.kind}-${transaction.id}`}
                className="flex min-w-0 items-start justify-between gap-4 p-4 sm:p-5"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold">{transaction.title}</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">
                    {transaction.status.replaceAll("_", " ")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(transaction.created_at).toLocaleDateString("en-NG", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <p
                  className={`shrink-0 text-right font-bold ${
                    transaction.amount < 0 ? "text-foreground" : "text-primary"
                  }`}
                >
                  {transaction.amount < 0 ? "−" : ""}
                  {itemPrice(Math.abs(transaction.amount))}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto rounded-2xl">
          <DialogTitle>Withdraw to your bank</DialogTitle>
          <DialogDescription className="leading-6">
            Select your bank and confirm the account name before sending{" "}
            {walletAmount(wallet.available)} or less.
          </DialogDescription>
          <form
            className="mt-2 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void withdraw();
            }}
          >
            <label className="block space-y-2 text-sm font-medium">
              Find your bank
              <Input
                placeholder="Type a bank name"
                value={bankSearch}
                onChange={(event) => setBankSearch(event.target.value)}
                disabled={busy || loadingBanks}
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Bank
              <select
                required
                value={bankCode}
                onChange={(event) => setBankCode(event.target.value)}
                disabled={busy || loadingBanks}
                className="h-11 w-full rounded-md border border-input bg-background px-3"
              >
                <option value="">{loadingBanks ? "Loading banks…" : "Choose your bank"}</option>
                {filteredBanks.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Account number
              <Input
                required
                inputMode="numeric"
                pattern="[0-9]{10}"
                minLength={10}
                maxLength={10}
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={(event) => setAccountNumber(event.target.value.replace(/\D/g, ""))}
                disabled={busy}
              />
            </label>
            {bankCode && accountNumber.length === 10 && (
              <p aria-live="polite" className="rounded-lg bg-muted px-3 py-2 text-sm">
                {resolving
                  ? "Verifying account name…"
                  : accountName
                    ? `Account name: ${accountName}`
                    : "Enter a valid account number."}
              </p>
            )}
            <label className="block space-y-2 text-sm font-medium">
              Amount in naira
              <Input
                required
                type="number"
                inputMode="decimal"
                min="1"
                max={(wallet.available / 100).toFixed(2)}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={busy}
              />
            </label>
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setAmount((wallet.available / 100).toFixed(2))}
            >
              Withdraw all ({walletAmount(wallet.available)})
            </button>
            {amount && !validAmount && (
              <p className="text-sm text-destructive">
                Enter an amount up to {walletAmount(wallet.available)}.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setWithdrawOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!accountName || !validAmount || busy}>
                {busy ? "Sending…" : "Withdraw now"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
