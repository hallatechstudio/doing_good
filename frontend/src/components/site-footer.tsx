import { Link } from "react-router-dom";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div>
          <p className="text-lg font-extrabold tracking-tight">
            <span className="text-primary">Doing</span>Good
          </p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            We help people give what they don't need to those who need it most.
          </p>
        </div>
        <div className="text-sm">
          <p className="eyebrow text-muted-foreground">Explore</p>
          <ul className="mt-4 space-y-3">
            <li>
              <Link to="/" className="transition-colors hover:text-primary">
                Browse items
              </Link>
            </li>
            <li>
              <Link to="/give" className="transition-colors hover:text-primary">
                Give an item
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="transition-colors hover:text-primary">
                My dashboard
              </Link>
            </li>
            <li>
              <Link to="/how-it-works" className="transition-colors hover:text-primary">
                How it works
              </Link>
            </li>
            <li>
              <Link to="/our-story" className="transition-colors hover:text-primary">
                Our story
              </Link>
            </li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow text-muted-foreground">Always free</p>
          <p className="mt-4 text-muted-foreground">
            Free to list. Free to request. DoingGood only coordinates the match - listing and
            requesting cost nothing.
          </p>
          <a
            href="https://doinggoodinitiative.com"
            className="mt-4 inline-block font-medium text-primary transition-opacity hover:opacity-80"
          >
            doinggoodinitiative.com
          </a>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        <nav aria-label="Legal" className="flex flex-wrap justify-center gap-5">
          <Link to="/privacy" className="hover:text-primary">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-primary">
            Terms of Use
          </Link>
        </nav>
        <p>© {new Date().getFullYear()} DoingGood Initiative · Lagos, Nigeria</p>
      </div>
    </footer>
  );
}
