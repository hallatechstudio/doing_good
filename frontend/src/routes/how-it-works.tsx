import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, HandHeart, Package, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const journeys = {
  find: [
    {
      icon: Search,
      title: "Find something you need.",
      body: "Browse free and paid furniture, clothes, books and essentials across Lagos without an account. Filter by price or category to find what works for you.",
    },
    {
      icon: HandHeart,
      title: "Request the item.",
      body: "For free items, join the ₦20,000 membership for 30 days, then contact the donor on WhatsApp. For paid items, sign in and use platform checkout when available. Membership is not needed to buy paid items.",
    },
    {
      icon: Truck,
      title: "Arrange the logistics.",
      body: "Arrange collection or delivery directly. For paid orders, confirm receipt in Orders only after checking your item. A seller's delivery notice starts a 24-hour review after email notification. Open a dispute before the deadline to freeze payout for review. DoingGood does not book deliveries.",
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
      body: "Sign in, add your WhatsApp number, choose free or paid, and upload honest photos and descriptions. For a paid item, set a naira price and add your verified payout account in Orders. Listing is free.",
    },
    {
      icon: Truck,
      title: "Plan pick-up or delivery.",
      body: "For free items, arrange collection on WhatsApp and update the listing status. For paid orders, report delivery with evidence in Orders. Payout follows buyer confirmation or an undisputed 24-hour review; a dispute pauses release until an admin resolves it.",
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

      <section className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <p className="eyebrow text-primary">Your next small act of good</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Make a little room.
              <br />
              Make a real difference.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/give">
                Give an item <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/">Browse free items</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
