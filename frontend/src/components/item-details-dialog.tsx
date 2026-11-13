import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MapPin, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { findItem } from "@/lib/api";
import { categoryLabel, conditionLabel, itemPrice, STATUS_LABELS } from "@/lib/site";
import type { Item } from "@/lib/types";

export function ItemDetailsDialog({
  item,
  onClose,
}: {
  item: Item;
  onClose: (destination?: string) => void;
}) {
  const { userId, loading } = useAuth();
  const cart = useCart();
  const opener = useRef(
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );
  const [active, setActive] = useState(0);
  const [phone, setPhone] = useState(item.donor_whatsapp || "");
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState("");
  const paid = (item.price_kobo || 0) > 0;
  const own = item.owner_id === userId;
  const photos = item.photos.length ? item.photos : ["/images/sofa.jpg"];
  const available = item.status === "available";
  useEffect(() => {
    if (paid || own || !userId || phone) return;
    let current = true;
    setContactBusy(true);
    void findItem(item.id)
      .then((latest) => {
        if (current) setPhone(latest?.donor_whatsapp || "");
      })
      .catch(() => {
        if (current)
          setContactError("Contact details could not be loaded. Please reopen this item.");
      })
      .finally(() => {
        if (current) setContactBusy(false);
      });
    return () => {
      current = false;
    };
  }, [item.id, userId, paid, own, phone]);
  function add() {
    try {
      cart.add(item);
      toast.success("Added to cart.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add this item.");
    }
  }
  const digits = phone.replace(/\D/g, "");
  const validPhone = /^[1-9]\d{7,14}$/.test(digits);
  const message = `Hi, I’m interested in getting the ${item.title}. Is it still available? ${window.location.origin}/items/${item.id}`;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-5xl overflow-hidden rounded-2xl p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (opener.current?.isConnected) opener.current.focus();
        }}
      >
        <div className="max-h-[85dvh] overflow-y-auto overscroll-contain">
          <div className="grid md:grid-cols-2">
            <div
              className="min-w-0 p-4 pt-12 sm:p-6 sm:pt-12"
              role="group"
              aria-label="Item photos"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  event.preventDefault();
                  setActive((active + 1) % photos.length);
                }
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  setActive((active - 1 + photos.length) % photos.length);
                }
              }}
            >
              <div className="relative overflow-hidden rounded-xl bg-muted">
                <img
                  src={photos[active]}
                  alt={`${item.title} — photo ${active + 1}`}
                  className="aspect-square w-full object-contain"
                />
                {photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() => setActive((active - 1 + photos.length) % photos.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/75 p-2 text-white"
                    >
                      <ChevronLeft />
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() => setActive((active + 1) % photos.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/75 p-2 text-white"
                    >
                      <ChevronRight />
                    </button>
                  </>
                )}
              </div>
              {photos.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                  {photos.map((photo, index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={`View photo ${index + 1}`}
                      aria-pressed={active === index}
                      onClick={() => setActive(index)}
                      className={`shrink-0 overflow-hidden rounded-lg border-2 ${active === index ? "border-primary" : "border-border"}`}
                    >
                      <img src={photo} alt="" className="size-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-2 text-center text-xs text-muted-foreground">
                {active + 1} / {photos.length}
              </p>
            </div>
            <div className="space-y-5 p-5 sm:p-6 md:pt-12">
              <p className="eyebrow text-primary">{categoryLabel(item.category)}</p>
              <DialogTitle className="text-2xl font-extrabold sm:text-3xl">
                {item.title}
              </DialogTitle>
              <DialogDescription>
                {conditionLabel(item.condition)} · {item.location}
              </DialogDescription>
              <p className="text-3xl font-bold text-primary">{itemPrice(item.price_kobo)}</p>
              {paid && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  {item.pickup_available !== false && <p>Free pickup in {item.location}</p>}
                  {item.delivery_fee_kobo != null && (
                    <p>
                      Delivery to {item.delivery_area} · {itemPrice(item.delivery_fee_kobo)}
                    </p>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
                {item.description}
              </p>
              <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" />
                {item.location}
              </p>
              <p className="text-sm text-muted-foreground">
                Offered by {item.donor_name || "a DoingGood neighbour"}
              </p>
              {own ? (
                <>
                  <p className="text-sm text-muted-foreground">This is your listing.</p>
                </>
              ) : available ? (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {paid && <Button
                      variant="outline"
                      onClick={cart.ids.includes(item.id) ? () => onClose("/cart") : add}
                      disabled={loading}
                    >
                      <ShoppingCart className="size-4" />
                      {cart.ids.includes(item.id) ? "View cart" : "Add to cart"}
                    </Button>}
                    {paid ? (
                      <Button
                        variant="hero"
                        onClick={() => onClose(`/checkout/${item.id}`)}
                        disabled={loading}
                      >
                        Get this item
                      </Button>
                    ) : !userId ? (
                      <Button asChild className="border-0 bg-emerald-600 text-white hover:bg-emerald-700">
                        <Link to={`/auth?next=${encodeURIComponent(`/items/${item.id}`)}`}><WhatsAppIcon className="size-5" />Message Giver</Link>
                      </Button>
                    ) : validPhone ? (
                      <Button asChild className="border-0 bg-emerald-600 text-white hover:bg-emerald-700">
                        <a
                          href={`https://wa.me/${digits}?text=${encodeURIComponent(message)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <WhatsAppIcon className="size-5" /> Message Giver
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" disabled>
                        {contactBusy ? "Loading contact…" : "Contact unavailable"}
                      </Button>
                    )}
                  </div>
                  <p className="text-xs leading-6 text-muted-foreground">
                    {paid
                      ? "Choose how to get your item and review the total at checkout."
                      : userId
                        ? "This item is free. Message the giver directly to arrange collection."
                        : "Sign in to message the giver and arrange collection."}
                  </p>
                  {contactError && (
                    <p role="alert" className="text-sm text-destructive">
                      {contactError}
                    </p>
                  )}
                </>
              ) : (
                <p role="status" className="text-primary">
                  {STATUS_LABELS[item.status] || "No longer available"}
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
