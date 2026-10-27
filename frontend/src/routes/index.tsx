import { useMemo, useState } from "react";
import { Link, useLoaderData } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ItemCard } from "@/components/item-card";
import { RequestModal } from "@/components/request-modal";
import { CATEGORIES } from "@/lib/site";
import type { Item } from "@/lib/types";

export function Index() {
  const items = useLoaderData() as Item[];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [requestItem, setRequestItem] = useState<Item | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q)
      );
    });
  }, [items, query, category]);

  return (
    <>
      <title>DoingGood - Free items for people who need them in Lagos</title>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 md:pb-24">
          <h1 className="max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
            Your nothing is <span className="text-primary">someone's everything.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            DoingGood helps people give what they don't need to people who need it. Furniture,
            clothes, appliances, books and more, matched across Lagos.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="hero" size="lg" asChild>
              <Link to="/give">Give an item</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <a href="#browse">Browse new items</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Search + filters + grid */}
      <section id="browse" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2 className="section-title">Available right now</h2>
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search items, e.g. sofa, books, Ikeja"
                className="pl-9"
                aria-label="Search items"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              onClick={() => setCategory(null)}
              className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                category === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(category === c.value ? null : c.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                  category === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="mt-16 text-center text-muted-foreground">
              Nothing matches that yet - new items are listed by donors every day.
            </p>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((item) => (
                <ItemCard key={item.id} item={item} onRequest={setRequestItem} />
              ))}
            </div>
          )}
        </div>
      </section>

      <RequestModal
        item={requestItem}
        open={requestItem !== null}
        onOpenChange={(open) => {
          if (!open) setRequestItem(null);
        }}
      />
    </>
  );
}
