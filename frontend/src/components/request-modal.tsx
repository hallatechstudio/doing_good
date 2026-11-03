import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthForm, type AuthMode } from "@/components/auth-form";
import { useAuth } from "@/lib/auth-context";
import type { Item } from "@/lib/types";
import { commerceSettings, currentUser, findItem } from "@/lib/api";
export function RequestModal({
  item,
  open,
  onOpenChange,
}: {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { userId } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [member, setMember] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifiedNumber, setVerifiedNumber] = useState("");
  const [checkError, setCheckError] = useState("");
  useEffect(() => {
    if (!open || !userId || !item) return;
    let active = true;
    setChecking(true);
    setVerifiedNumber("");
    setCheckError("");
    void Promise.all([currentUser(), findItem(item.id), commerceSettings()])
      .then(([profile, latest, settings]) => {
        if (!active) return;
        setMember(
          !settings.membership_required ||
            Boolean(profile?.membership_until && new Date(profile.membership_until) > new Date()),
        );
        setVerifiedNumber(latest?.donor_whatsapp || "");
      })
      .catch(() => {
        if (active) setCheckError("Could not check membership. Close this window and try again.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [open, userId, item]);
  const digits = verifiedNumber.replace(/\D/g, "");
  const valid = /^[1-9]\d{7,14}$/.test(digits);
  const text = item
    ? `Hi! I'm interested in ${item.title} on DoingGood. Is it still available? ${window.location.origin}/items/${item.id}`
    : "";
  const donor = item?.donor_name || "the donor";
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setAuthMode(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        {authMode ? (
          <AuthForm
            key={authMode}
            initialMode={authMode}
            header={({ title, description }) => (
              <>
                <DialogTitle className="text-xl font-extrabold">{title}</DialogTitle>
                <DialogDescription className="mt-2">{description}</DialogDescription>
              </>
            )}
            onDone={() => setAuthMode(null)}
          />
        ) : userId && (checking || checkError) ? (
          <>
            <DialogTitle>Checking membership</DialogTitle>
            <DialogDescription>
              {checkError || "Checking your access to free items…"}
            </DialogDescription>
          </>
        ) : userId && !member ? (
          <>
            <DialogTitle>Membership for free items</DialogTitle>
            <DialogDescription>
              Join for ₦20,000 for 30 days to request free items and contact donors. Availability
              and donor approval apply; membership does not guarantee an item.
            </DialogDescription>
            <Button asChild variant="hero">
              <Link to="/#membership" onClick={() => onOpenChange(false)}>
                View membership
              </Link>
            </Button>
          </>
        ) : userId ? (
          <>
            <DialogTitle>Contact {donor}</DialogTitle>
            <DialogDescription>
              Ask about {item?.title || "this item"} and arrange pick-up or delivery directly on
              WhatsApp.
            </DialogDescription>
            {valid ? (
              <Button asChild variant="hero">
                <a
                  href={`https://wa.me/${digits}?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Continue on WhatsApp
                </a>
              </Button>
            ) : (
              <p role="status" className="text-sm text-muted-foreground">
                The donor has not added a valid WhatsApp number yet.
              </p>
            )}
          </>
        ) : (
          <>
            <DialogTitle>Create an account to request this item</DialogTitle>
            <DialogDescription>
              Create an account, then join the ₦20,000 membership for 30 days of access to request
              free items and contact {donor} on WhatsApp. Membership does not guarantee an item.
            </DialogDescription>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="hero" className="w-full" onClick={() => setAuthMode("signup")}>
                Create an account
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setAuthMode("signin")}>
                Sign in
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
