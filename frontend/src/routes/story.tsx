import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const questions = [
  [
    "Does it cost anything?",
    "Listing and requesting items are completely free. DoingGood coordinates the match. Pick-up or delivery arrangements are agreed separately; submitting a request does not book a delivery.",
  ],
  [
    "Do I need an account to browse or request?",
    "You can browse listings without an account, but you need a free one to request or give an item. Sign up with your email and password, add your WhatsApp number, then contact donors on WhatsApp or list what you no longer need.",
  ],
  [
    "What can I give?",
    "Useful household items such as furniture, clothing, appliances, kitchen items, books, baby essentials and electronics. Use clear photos and describe any wear or repairs needed so the recipient knows what to expect.",
  ],
  [
    "What happens after I request an item?",
    "Tap Request this item - you will be asked to create an account or sign in first, then continue on WhatsApp to message the donor. Agree on availability, pick-up or delivery together. DoingGood does not reserve items, book deliveries or collect payments.",
  ],
  [
    "Where does DoingGood operate?",
    "The community is focused on Lagos. Each listing includes a neighbourhood so you can see where an item is located before requesting it.",
  ],
];

export function StoryPage() {
  return (
    <>
      <title>Our story & FAQs | DoingGood</title>
      <section
        id="our-story"
        className="scroll-mt-32 border-y border-border bg-card/40"
        aria-labelledby="story-heading"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-20">
            <div>
              <p className="eyebrow text-primary">Our story</p>
              <h1
                id="story-heading"
                className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl"
              >
                A home is more
                <br />
                than four walls.
              </h1>
            </div>
            <p className="max-w-xl self-end text-lg leading-relaxed text-muted-foreground">
              DoingGood grew from a simple observation: while useful things sit unused in one home,
              another family is trying to build a life without the essentials. A connection can
              change that.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              {
                label: "Before",
                title: "An empty room.",
                body: "A housekeeper and mother of two moved into a new home with barely any furniture or basic household appliances.",
              },
              {
                label: "The bridge",
                title: "One generous connection.",
                body: "She connected with DoingGood and was matched with a donor who had unused household furniture and working appliances.",
              },
              {
                label: "After",
                title: "A place to feel at home.",
                body: "Her home was furnished at zero cost, giving her family comfort, stability and dignity. What was no longer needed became everything.",
              },
            ].map((chapter, index) => (
              <article
                key={chapter.label}
                className={
                  "relative rounded-2xl border p-7 sm:p-8 " +
                  (index === 2
                    ? "border-primary/30 bg-panel text-panel-foreground"
                    : "border-border bg-background")
                }
              >
                <p className={"eyebrow " + (index === 2 ? "text-white/70" : "text-primary")}>
                  {chapter.label}
                </p>
                <div className="my-7 h-px bg-current opacity-10" />
                <h3 className="text-2xl font-bold tracking-tight">{chapter.title}</h3>
                <p
                  className={
                    "mt-4 text-sm leading-7 " +
                    (index === 2 ? "text-white/80" : "text-muted-foreground")
                  }
                >
                  {chapter.body}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-12 grid gap-8 border-t border-border pt-10 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr]">
            <div>
              <p className="eyebrow text-primary">The good keeps going</p>
              <p className="mt-3 max-w-sm text-muted-foreground">
                Practical help. Real lives. A community with more to give.
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold">Homes furnished</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Our pilot helped families turn empty rooms into furnished homes, at zero cost.
              </p>
            </div>
            <div>
              <p className="text-3xl font-extrabold text-primary">1,000 children</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Fed in Makoko through our earlier work at HelpLeads Nigeria.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24"
        aria-label="Frequently asked questions"
      >
        <div className="divide-y divide-border border-y border-border">
          {questions.map(([question, answer]) => (
            <details key={question} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-base font-semibold [&::-webkit-details-marker]:hidden">
                {question}
                <span
                  aria-hidden="true"
                  className="text-xl font-normal text-primary group-open:hidden"
                >
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="hidden text-xl font-normal text-primary group-open:block"
                >
                  -
                </span>
              </summary>
              <p className="mt-4 max-w-xl pr-6 text-sm leading-7 text-muted-foreground">{answer}</p>
            </details>
          ))}
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
