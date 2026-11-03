import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Crown, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commerceSettings, membershipCheckout } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useAuthDialog } from "@/components/auth-dialog";

export function MembershipButton({ available = true }: { available?: boolean }) {
  const { userId } = useAuth();
  const { openAuth } = useAuthDialog();
  const [busy, setBusy] = useState(false);
  async function join() {
    if (!userId) {
      openAuth({ mode: "signup", next: "/#membership" });
      return;
    }
    setBusy(true);
    try {
      const checkout = await membershipCheckout();
      window.location.assign(checkout.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout is unavailable.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="hero" size="lg" onClick={join} disabled={busy || !available}>
      {!available
        ? "Coming soon — ₦20,000"
        : busy
          ? "Opening checkout…"
          : "Join membership — ₦20,000"}
    </Button>
  );
}

export function MembershipSection() {
  const [launching, setLaunching] = useState(true);
  useEffect(() => {
    void commerceSettings()
      .then((settings) => setLaunching(!settings.membership_checkout))
      .catch(() => setLaunching(true));
  }, []);
  return (
    <section
      id="membership"
      aria-labelledby="membership-heading"
      className="scroll-mt-24 border-y border-border bg-card"
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-20">
        <div>
          <Crown className="size-8 text-primary" />
          <p className="eyebrow mt-5 text-primary">DoingGood membership</p>
          {launching && (
            <p role="status" className="mt-4 text-sm text-primary">
              Membership payments are coming soon. Free-item requests remain open to signed-in users
              until launch.
            </p>
          )}
          <h2 id="membership-heading" className="section-title mt-4">
            Find your next good thing.
          </h2>
          <p className="mt-5 max-w-xl leading-7 text-muted-foreground">
            Join for ₦20,000 for 30 days of access to request free items as they arrive. Browse
            first, then become a member when you are ready to contact a donor.
          </p>
          <ul className="my-6 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Request free items and arrange collection on WhatsApp.</li>
            <li>See all available listings before joining.</li>
            <li>Renew when you choose. No automatic charges.</li>
          </ul>
          <MembershipButton available={!launching} />
          <p className="mt-4 max-w-xl text-xs leading-6 text-muted-foreground">
            The membership fee is separate from item prices. Items are subject to availability and
            donor approval; membership does not guarantee an item. Delivery costs, if any, are
            agreed separately.{" "}
            <Link to="/terms" className="text-primary underline">
              Read the terms
            </Link>
            .
          </p>
        </div>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <ShieldCheck className="size-8 text-primary" />
          <h3 className="mt-5 text-2xl font-bold">Buying a paid item?</h3>
          <p className="mt-4 leading-7 text-muted-foreground">
            Membership is not required for paid items. Where protected checkout is available, pay on
            DoingGood and manage delivery in your orders.
          </p>
          <ol className="mt-6 list-decimal space-y-4 pl-5 text-sm leading-6 text-muted-foreground">
            <li>The seller receives no payout when you pay.</li>
            <li>Confirm receipt only after you have received and checked the item.</li>
            <li>
              When the seller reports delivery, you receive an email and have 24 hours to raise a
              dispute before release becomes due.
            </li>
            <li>A dispute pauses release until it has been reviewed.</li>
          </ol>
          <p className="mt-6 text-xs leading-6 text-muted-foreground">
            Never pay a seller directly if you want the platform's order protection. Paid checkout
            will open once payment holding is configured.
          </p>
        </div>
      </div>
    </section>
  );
}
