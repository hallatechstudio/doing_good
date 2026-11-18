import { useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router-dom";
import { Share2, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItemDetailsDialog } from "@/components/item-details-dialog";
import { findItem } from "@/lib/api";
import { readCartIds, useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth-context";
import { itemPrice } from "@/lib/site";
import type { Item } from "@/lib/types";

export async function cartLoader() {
  return Promise.all(readCartIds().map(async (id) => ({ id, item: await findItem(id) })));
}
export function CartPage() {
  const data = useLoaderData() as Awaited<ReturnType<typeof cartLoader>>;
  const cart = useCart();
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [viewing, setViewing] = useState<Item | null>(null);
  const entries = data.filter((entry) => cart.ids.includes(entry.id));
  const total = entries.reduce((sum, entry) => sum + (entry.item?.price_kobo || 0), 0);
  const invalid = cart.ids.some((id) => {
    const entry = entries.find((entry) => entry.id === id);
    return !entry?.item || entry.item.status !== "available" || entry.item.owner_id === userId;
  });
  async function shareItem(item: Item) {
    const url = new URL(`/api/share/items/${item.id}`, window.location.origin).toString();
    const text = `${item.title} — ${item.description.slice(0, 140)}`;
    try {
      if (navigator.share) await navigator.share({ title: item.title, text, url });
      else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Closing the native share menu is expected and needs no error message.
    }
  }
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <title>Your cart | DoingGood</title>
      <p className="eyebrow text-primary">Your next good finds</p>
      <h1 className="section-title mt-4">
        Your cart <span className="text-muted-foreground">({cart.ids.length})</span>
      </h1>
      <p className="mt-4 text-sm leading-7 text-muted-foreground">
        See everything you have selected. Each listing is one item; adding it to your cart does not
        reserve it.
      </p>
      {!cart.ids.length ? (
        <div className="my-10 rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <ShoppingCart className="mx-auto size-10 text-primary" />
          <h2 className="mt-5 text-xl font-bold">Your cart is ready for something good.</h2>
          <Button asChild className="mt-6">
            <Link to="/">Browse items</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-4">
            {entries.map(({ id, item }) => (
              <article key={id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
                {item ? (
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setViewing(item)}
                      aria-label={`View ${item.title}`}
                      className="shrink-0"
                    >
                      <img
                        src={item.photos[0] || "/images/sofa.jpg"}
                        alt={item.title}
                        className="size-20 rounded-lg object-cover sm:size-24"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setViewing(item)}
                        className="text-left text-lg font-bold hover:text-primary"
                      >
                        {item.title}
                      </button>
                      <p className="mt-2 font-bold text-primary">{itemPrice(item.price_kobo)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.location}</p>
                      {(item.status !== "available" || item.owner_id === userId) && (
                        <p role="status" className="mt-2 text-sm text-muted-foreground">
                          {item.owner_id === userId
                            ? "This is your own listing. Remove it before checkout."
                            : "This item is no longer available. Remove it before checkout."}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p role="status" className="text-sm text-muted-foreground">
                    This listing is no longer available. Remove it before checkout.
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  {item && (
                    <Button size="sm" variant="outline" onClick={() => setViewing(item)}>
                      View item
                    </Button>
                  )}
                  {item && <Button size="sm" className="bg-violet-600 text-white hover:bg-violet-700" onClick={() => void shareItem(item)}><Share2 className="size-4" />Share</Button>}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => cart.remove(id)}
                    aria-label={`Remove ${item?.title || "unavailable item"}`}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                </div>
              </article>
            ))}
            <Button variant="ghost" onClick={() => cart.removeMany(cart.ids)}>
              Clear cart
            </Button>
          </div>
          <aside className="space-y-5 rounded-xl border border-border bg-card p-6">
            <h2 className="text-xl font-bold">Your selection</h2>
            <div className="flex justify-between text-sm">
              <span>Items</span>
              <span>{cart.ids.length}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-4 text-xl font-bold">
              <span>Total</span>
              <span className="text-primary">{total > 0 ? itemPrice(total) : "Free"}</span>
            </div>
            <p className="text-xs leading-6 text-muted-foreground">
              Free items have no amount. Arrange collection directly with each giver.
              Delivery costs are agreed separately.
            </p>
            {invalid && (
              <p role="status" className="text-sm text-muted-foreground">
                Remove unavailable items or your own listings to continue.
              </p>
            )}
            <Button
              asChild={!invalid}
              variant="hero"
              size="lg"
              className="w-full"
              disabled={invalid}
            >
              {invalid ? (
                <span>Review your cart</span>
              ) : (
                <Link to="/checkout">
                  {total > 0 ? "Continue to checkout" : "Arrange collection"}
                </Link>
              )}
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/">Find more items</Link>
            </Button>
          </aside>
        </div>
      )}
      {viewing && (
        <ItemDetailsDialog
          key={viewing.id}
          item={viewing}
          onClose={(destination) => {
            setViewing(null);
            if (destination) void navigate(destination);
          }}
        />
      )}
    </div>
  );
}
