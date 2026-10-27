import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  const digits = (item?.donor_whatsapp || "").replace(/\D/g, "");
  const valid = /^[1-9]\d{7,14}$/.test(digits);
  const text = item
    ? `Hi! I'm interested in ${item.title} on DoingGood. Is it still available? ${window.location.origin}/items/${item.id}`
    : "";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Contact {item?.donor_name || "the donor"}</DialogTitle>
        <DialogDescription>
          Ask about {item?.title || "this item"} and arrange pick-up or delivery directly on
          WhatsApp. No DoingGood account is needed.
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
      </DialogContent>
    </Dialog>
  );
}
