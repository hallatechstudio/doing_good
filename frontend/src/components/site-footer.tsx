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
            Give and get useful items from people everywhere.
          </p>
        </div>
        <div className="text-sm">
          <p className="eyebrow text-muted-foreground">Explore</p>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
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
            <li><Link to="/contact" className="transition-colors hover:text-primary">Contact</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="eyebrow text-muted-foreground">Give. Get. Find.</p>
          <p className="mt-4 text-muted-foreground">
            Browse and list for free. Give items away or set a fair amount. Add your favourites to
            your cart and check out when you are ready.
          </p>
          <a
            href="https://doinggoodeverywhere.com"
            className="mt-4 inline-block font-medium text-primary transition-opacity hover:opacity-80"
          >
            doinggoodeverywhere.com
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
