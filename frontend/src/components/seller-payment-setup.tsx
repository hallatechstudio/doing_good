import { useEffect, useId, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  commerceSettings,
  currentUser,
  payoutBanks,
  resolvePayoutName,
  savePayout,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function uniqueBanks(banks: { name: string; code: string }[]) {
  const seen = new Set<string>();
  return banks.filter((bank) => {
    if (seen.has(bank.code)) return false;
    seen.add(bank.code);
    return true;
  });
}

export function SellerPaymentSetup({
  savedName,
  onSaved,
}: {
  savedName?: string | null | undefined;
  onSaved?: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [name, setName] = useState(savedName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [bankCode, setBankCode] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [resolvedName, setResolvedName] = useState("");
  const [resolvingName, setResolvingName] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);

  async function show() {
    setOpen(true);
    setBusy(true);
    setError("");
    setBanks([]);
    setBankCode("");
    setBankSearch("");
    setAccountNumber("");
    setResolvedName("");
    setResolveError("");
    try {
      const [settings, profile] = await Promise.all([commerceSettings(), currentUser()]);
      setName(profile?.payout_name || savedName || "");
      if (!settings.protected_checkout) {
        throw new Error(
          "Payment setup is not available yet. Please check back when online payments open.",
        );
      }
      setBanks(uniqueBanks(await payoutBanks()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment setup could not be loaded.");
    } finally {
      setBusy(false);
    }
  }

  // Resolve the account name once a bank is selected and the number is complete (10 digits).
  useEffect(() => {
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) {
      setResolvedName("");
      setResolveError("");
      setResolvingName(false);
      return;
    }
    let active = true;
    setResolvingName(true);
    setResolveError("");
    const handle = window.setTimeout(async () => {
      try {
        const result = await resolvePayoutName(bankCode, accountNumber);
        if (active) setResolvedName(result.account_name);
      } catch (reason) {
        if (active) {
          setResolvedName("");
          setResolveError(
            reason instanceof Error ? reason.message : "Could not verify this account number.",
          );
        }
      } finally {
        if (active) setResolvingName(false);
      }
    }, 700);
    return () => {
      active = false;
      window.clearTimeout(handle);
    };
  }, [bankCode, accountNumber, lookupAttempt]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await savePayout(String(form.get("bank")), String(form.get("account")));
      setName(result.name);
      setBanks([]);
      setBankCode("");
      setBankSearch("");
      setAccountNumber("");
      setResolvedName("");
      setOpen(false);
      onSaved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not verify this bank account.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-4 rounded-xl border border-border p-4">
      <h2 className="text-base font-bold">Bank account</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Your verified account is used only when you choose to withdraw wallet earnings.
      </p>
      {name && (
        <p role="status" className="mt-3 text-sm text-primary">
          Payout account: {name}
        </p>
      )}
      {!open ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={show}>
            <CreditCard className="size-4" />
            {name ? "Change bank account" : "Add bank account"}
          </Button>
        </div>
      ) : (
        <>
          {busy && !banks.length && (
            <p role="status" className="mt-4 text-sm text-muted-foreground">
              Loading payment setup…
            </p>
          )}
          {banks.length > 0 && (
            <form onSubmit={save} className="mt-4 max-w-lg space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${id}-bank-search`}>Find your bank</Label>
                <Input
                  id={`${id}-bank-search`}
                  placeholder="Type a bank name"
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-bank`}>Bank</Label>
                <select
                  id={`${id}-bank`}
                  name="bank"
                  required
                  disabled={busy}
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3"
                >
                  <option value="">Choose your bank</option>
                  {banks
                    .filter((bank) =>
                      bank.name.toLocaleLowerCase().includes(bankSearch.trim().toLocaleLowerCase()),
                    )
                    .map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                </select>
                {bankSearch &&
                  !banks.some((bank) =>
                    bank.name.toLocaleLowerCase().includes(bankSearch.trim().toLocaleLowerCase()),
                  ) && (
                    <p className="text-xs text-muted-foreground">
                      No matching bank found. Try its official name.
                    </p>
                  )}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${id}-account`}>Account number</Label>
                <Input
                  id={`${id}-account`}
                  name="account"
                  required
                  disabled={busy}
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  minLength={10}
                  maxLength={10}
                  autoComplete="off"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              {bankCode && accountNumber.length === 10 && (
                <p
                  role="status"
                  className="text-sm leading-6 text-muted-foreground"
                  aria-live="polite"
                >
                  {resolvingName
                    ? "Resolving account name…"
                    : resolvedName
                      ? `Account name: ${resolvedName}`
                      : resolveError
                        ? resolveError
                        : "Resolving account name…"}
                </p>
              )}
              {resolveError && /^\d{10}$/.test(accountNumber) && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={resolvingName}
                  onClick={() => setLookupAttempt((attempt) => attempt + 1)}
                >
                  Retry account lookup
                </Button>
              )}
              <p className="text-xs leading-6 text-muted-foreground">
                Your details are sent securely for verification and saved only after the account
                name is confirmed.
              </p>
              <Button type="submit" disabled={busy || !resolvedName}>
                {busy ? "Verifying…" : "Verify and save payment details"}
              </Button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="button"
            variant="ghost"
            className="mt-3"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </>
      )}
    </section>
  );
}
