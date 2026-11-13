import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appUrl, categoryLabel, conditionLabel, itemPrice, STATUS_LABELS } from "@/lib/site";
import type { Item } from "@/lib/types";
import { Link } from "react-router-dom";

export function ItemCard({ item, onView }: { item: Item; onView: (item: Item) => void }) {
  const cart = useCart();
  const { userId, loading } = useAuth();
  const own = userId === item.owner_id;
  const added = cart.ids.includes(item.id);
  function add() {
    try {
      cart.add(item);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add item.");
    }
  }
  const digits = item.donor_whatsapp.replace(/\D/g, "");
  const whatsappMessage = `Hi! I'm interested in ${item.title} on DoingGood. Is it still available? ${appUrl}/items/${item.id}`;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <button
        type="button"
        onClick={() => onView(item)}
        aria-label={`View ${item.title}`}
        className="relative block aspect-square w-full overflow-hidden bg-muted"
      >
        <img
          src={item.photos[0] || "/images/sofa.jpg"}
          alt={item.title}
          loading="lazy"
          width={1024}
          height={1024}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <Badge className="absolute left-3 top-3 bg-background/80 text-foreground backdrop-blur">
          {categoryLabel(item.category)}
        </Badge>
        {item.status !== "available" && (
          <Badge className="absolute right-3 top-3 bg-background/80 text-primary">
            {STATUS_LABELS[item.status] || item.status}
          </Badge>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-lg font-bold text-primary">{itemPrice(item.price_kobo)}</p>
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => onView(item)}
            className="text-left font-semibold leading-snug hover:text-primary"
          >
            {item.title}
          </button>
          <span className="shrink-0 text-xs text-muted-foreground">
            {conditionLabel(item.condition)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5" />
          {item.location}
        </p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          <Button asChild size="sm" variant="outline"><Link to={`/items/${item.id}`}>View item</Link></Button>
          {(item.price_kobo || 0) > 0 && <Button
            size="sm"
            disabled={loading || own || added || item.status !== "available"}
            onClick={add}
          >
            {own ? "Your listing" : added ? "In cart" : "Add to cart"}
          </Button>}
          {!(item.price_kobo || 0) && (userId && /^[1-9]\d{7,14}$/.test(digits) ? <Button asChild size="sm" className="border-0 bg-emerald-600 text-white hover:bg-emerald-700">
            <a href={`https://wa.me/${digits}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" />Message Giver</a>
          </Button> : <Button asChild size="sm" className="border-0 bg-emerald-600 text-white hover:bg-emerald-700"><Link to={`/auth?next=${encodeURIComponent(`/items/${item.id}`)}`}><WhatsAppIcon className="size-5" />Message Giver</Link></Button>)}
        </div>
      </div>
    </article>
  );
}
