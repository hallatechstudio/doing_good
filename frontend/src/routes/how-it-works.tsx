import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, HandHeart, Package, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const journeys = {
  find: [
    {
      icon: Search,
      title: "Find something you need.",
      body: "Browse free and paid furniture, clothes, books and essentials across Lagos without an account. Filter by amount or category to find what works for you.",
    },
    {
      icon: HandHeart,
      title: "Request the item.",
      body: "Open an item to view its photos and details. Add free or paid items to your cart. For paid items, continue to a separate checkout page. For free items, sign in and contact the donor directly.",
    },
    {
      icon: Truck,
      title: "Arrange the logistics.",
      body: "For paid items, choose pickup or delivery at checkout and review the total before paying. After payment, message the giver and arrange delivery. Your money is held until the receiver confirms delivery.",
    },
  ],
  give: [
    {
      icon: Heart,
      title: "Start with what you have.",
      body: "A chair you no longer use. Books your children have outgrown. Something useful and in a condition you would feel good passing on.",
    },
    {
      icon: Package,
      title: "Give it a good introduction.",
      body: "Sign in, add your WhatsApp number, and upload photos and a description. For a paid item, set an amount and choose pickup or delivery. Listing is free.",
    },
    {
      icon: Truck,
      title: "Plan pick-up or delivery.",
      body: "Arrange collection on WhatsApp for free items. For paid orders, message the receiver and confirm delivery in Order history.",
    },
  ],
};

export function HowItWorksPage() {
  const [journey, setJourney] = useState<"find" | "give">("find");
  return (
    <>
      <title>How it works | DoingGood</title>

      <section
        aria-labelledby="steps-heading"
        className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24"
      >
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-primary">How it works</p>
            <h1 id="steps-heading" className="section-title mt-4">
              Small steps. Meaningful change.
            </h1>
          </div>
          <div
            role="group"
            aria-label="Choose your journey"
            className="inline-flex rounded-full border border-border bg-card p-1"
          >
            {(["find", "give"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={journey === value}
                onClick={() => setJourney(value)}
                className={
                  "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors " +
                  (journey === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {value === "find" ? "I need an item" : "I want to give"}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {journeys[journey].map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-5xl font-extrabold tracking-tight text-primary/30">
                  0{index + 1}
                </span>
                <Icon className="size-6 text-primary" strokeWidth={1.5} />
              </div>
              <h3 className="mt-8 text-xl font-bold tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="hero" size="lg">
            <Link to="/give">Give an item</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/">Browse items</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
