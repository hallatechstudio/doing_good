import { useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { ArrowLeft, MapPin, Tag, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RequestModal } from "@/components/request-modal";
import { useAuth } from "@/lib/auth-context";
import { categoryLabel, conditionLabel, STATUS_LABELS } from "@/lib/site";
import type { Item } from "@/lib/types";

export function ItemDetail() {
  const item = useLoaderData() as Item;
  const { userId } = useAuth();
  const [active, setActive] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);

  const canRequest = item.status === "available";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to browse
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <title>{`${item.title} - Free in ${item.location} | DoingGood`}</title>
        {/* Photos */}
        <div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <img
              src={item.photos[active] ?? item.photos[0] ?? "/images/sofa.jpg"}
              alt={item.title}
              width={1024}
              height={1024}
              className="aspect-square w-full object-cover"
            />
          </div>
          {item.photos.length > 1 && (
            <div className="mt-4 flex gap-3">
              {item.photos.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setActive(i)}
                  className={`overflow-hidden rounded-lg border-2 transition-colors ${
                    i === active ? "border-primary" : "border-border"
                  }`}
                  aria-label={`View photo ${i + 1}`}
                >
                  <img
                    src={p}
                    alt=""
                    loading="lazy"
                    width={96}
                    height={96}
                    className="size-20 object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary">{categoryLabel(item.category)}</Badge>
            <Badge variant="outline" className="text-muted-foreground">
              <Tag className="mr-1 size-3" />
              {conditionLabel(item.condition)}
            </Badge>
            {item.status !== "available" && (
              <Badge variant="outline" className="text-primary">
                {STATUS_LABELS[item.status] ?? item.status}
              </Badge>
            )}
          </div>

          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">{item.title}</h1>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-4" /> {item.location}
          </p>

          <p className="mt-6 leading-relaxed text-muted-foreground">{item.description}</p>

          {item.donor_name && (
            <p className="mt-6 text-sm text-muted-foreground">
              Offered by <span className="text-foreground">{item.donor_name}</span>
            </p>
          )}

          <div className="mt-8 rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">
              Free to request. Contact the donor on WhatsApp to ask about availability and arrange
              pick-up or delivery.
            </p>
            {canRequest ? (
              <Button variant="hero" size="lg" className="mt-4" onClick={() => setModalOpen(true)}>
                <MessageCircle className="size-4" /> Request this item
              </Button>
            ) : (
              <p className="mt-4 font-medium text-primary">
                {STATUS_LABELS[item.status] ?? item.status} - no longer accepting new requests.
              </p>
            )}
            {!canRequest && (
              <Button variant="outline" className="mt-4" onClick={() => setModalOpen(true)}>
                <MessageCircle className="size-4" /> Discuss collection
              </Button>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              {userId
                ? "Continue on WhatsApp to contact the donor directly."
                : "You need a free DoingGood account to request this item and contact the donor on WhatsApp."}
            </p>
          </div>
        </div>
      </div>

      <RequestModal
        item={item}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
        }}
      />
    </div>
  );
}
