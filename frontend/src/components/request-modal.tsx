import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthForm, type AuthMode } from "@/components/auth-form";
import { useAuth } from "@/lib/auth-context";
import type { Item } from "@/lib/types";
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
  const digits = (item?.donor_whatsapp || "").replace(/\D/g, "");
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
      <DialogContent>
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
              Requesting items is free, but you need a DoingGood account first so donors know who
              they are giving to. Create one in a minute, then contact {donor} on WhatsApp.
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
