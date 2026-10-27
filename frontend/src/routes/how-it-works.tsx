import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Heart, HandHeart, Package, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

const journeys = {
  find: [
    {
      icon: Search,
      title: "Find something you need.",
      body: "Explore furniture, clothes, books and everyday essentials from neighbours across Lagos. Browse and filter freely, without an account.",
    },
    {
      icon: HandHeart,
      title: "Request the item.",
      body: "Open a listing and tap Request to contact the donor directly on WhatsApp. Ask whether the item is available and share what you need. No account is needed.",
    },
    {
      icon: Truck,
      title: "Arrange the logistics.",
      body: "Use the same WhatsApp conversation to agree on pick-up or delivery, the neighbourhood and a suitable time. Discuss any delivery costs before confirming. Agree on arrangements directly; DoingGood does not book deliveries.",
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
      body: "Sign in with your email and password, add your WhatsApp number, upload clear photos and describe the condition honestly. Choose a category and your neighbourhood in Lagos. Listing is always free.",
    },
    {
      icon: Truck,
      title: "Plan pick-up or delivery.",
      body: "Chat with the recipient on WhatsApp to agree on the collection point, delivery arrangements and timing. Then mark the item matched or given in your dashboard.",
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
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 px-6 py-5">
          <p className="text-sm text-muted-foreground">
            A simple exchange. A useful item. A little more possibility.
          </p>
          <Link
            to={journey === "find" ? "/" : "/give"}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            {journey === "find" ? "Explore available items" : "List your first item"}
            <ArrowRight className="size-4" />
          </Link>
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
