import { useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { Copy, MapPin, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppIcon } from "@/components/whatsapp-icon";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { categoryLabel, conditionLabel, itemPrice } from "@/lib/site";
import type { Item } from "@/lib/types";

export function ItemDetail() {
  const item = useLoaderData() as Item;
  const { userId } = useAuth();
  const cart = useCart();
  const [copying, setCopying] = useState(false);
  const paid = (item.price_kobo || 0) > 0;
  const own = item.owner_id === userId;
  const digits = item.donor_whatsapp.replace(/\D/g, "");
  const productUrl = window.location.href;
  const whatsapp = `Hi, I’m interested in getting the ${item.title}. Is it still available? ${productUrl}`;

  async function copyLink() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(productUrl);
      toast.success("Product link copied.");
    } catch {
      toast.error("Could not copy the product link. Copy it from your browser address bar.");
    } finally {
      setCopying(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <Link to="/" className="text-sm font-medium text-primary hover:underline">← Back to items</Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
        <section className={item.photos.length > 1 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
          {item.photos.map((photo, index) => (
            <img key={photo} src={photo} alt={`${item.title} — photo ${index + 1}`} className="aspect-square w-full rounded-2xl bg-muted object-cover" />
          ))}
        </section>
        <section className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">{categoryLabel(item.category)}</p>
          <h1 className="section-title">{item.title}</h1>
          <p className="text-muted-foreground">{conditionLabel(item.condition)} · {item.location}</p>
          <p className="text-3xl font-extrabold text-primary">{itemPrice(item.price_kobo)}</p>
          <p className="whitespace-pre-wrap leading-7 text-muted-foreground">{item.description}</p>
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{item.location}</p>
          {paid && <div className="text-sm text-muted-foreground">{item.pickup_available !== false && <p>Pickup available</p>}{item.delivery_fee_kobo != null && <p>Delivery to {item.delivery_area} · {itemPrice(item.delivery_fee_kobo)}</p>}</div>}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm font-semibold">Share this item</p>
            <p className="mt-1 text-sm text-muted-foreground">Send this product link to anyone who may be interested.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void copyLink()} disabled={copying}>
              <Copy className="size-4" /> {copying ? "Copying…" : "Copy product link"}
            </Button>
          </div>
          {!own && item.status === "available" && (paid ? (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => cart.add(item)}><ShoppingCart className="size-4" />{cart.ids.includes(item.id) ? "In cart" : "Add to cart"}</Button>
              <Button asChild variant="hero"><Link to={`/checkout/${item.id}`}>Get this item</Link></Button>
            </div>
          ) : userId && /^[1-9]\d{7,14}$/.test(digits) ? (
            <Button asChild className="border-0 bg-emerald-600 text-white hover:bg-emerald-700"><a href={`https://wa.me/${digits}?text=${encodeURIComponent(whatsapp)}`} target="_blank" rel="noopener noreferrer"><WhatsAppIcon className="size-5" />Message Giver</a></Button>
          ) : (
            <Button asChild className="border-0 bg-emerald-600 text-white hover:bg-emerald-700"><Link to={`/auth?next=${encodeURIComponent(`/items/${item.id}`)}`}><WhatsAppIcon className="size-5" />Message Giver</Link></Button>
          ))}
        </section>
      </div>
    </main>
  );
}
