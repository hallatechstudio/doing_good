import { Link } from "react-router-dom";
import { MapPin, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categoryLabel, conditionLabel, STATUS_LABELS } from "@/lib/site";
import type { Item } from "@/lib/types";

export function ItemCard({ item, onRequest }: { item: Item; onRequest: (item: Item) => void }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40">
      <Link
        to={`/items/${item.id}`}
        className="relative block aspect-square overflow-hidden bg-muted"
      >
        <img
          src={item.photos[0] ?? "/images/sofa.jpg"}
          alt={item.title}
          loading="lazy"
          width={1024}
          height={1024}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <Badge className="absolute left-3 top-3 bg-background/80 text-foreground backdrop-blur">
          {categoryLabel(item.category)}
        </Badge>
        {item.status === "pending" && (
          <Badge className="absolute right-3 top-3 border-primary/50 bg-background/80 text-primary backdrop-blur">
            {STATUS_LABELS["pending"]}
          </Badge>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            to={`/items/${item.id}`}
            className="font-semibold leading-snug transition-colors hover:text-primary"
          >
            {item.title}
          </Link>
          <span className="shrink-0 text-xs text-muted-foreground">
            {conditionLabel(item.condition)}
          </span>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            {item.location}
          </span>
          <Button size="sm" variant="outline" onClick={() => onRequest(item)}>
            <MessageCircle className="size-4" /> Request item
          </Button>
        </div>
      </div>
    </article>
  );
}
