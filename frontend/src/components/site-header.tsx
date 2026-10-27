import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useAuthDialog } from "@/components/auth-dialog";
import { signOut } from "@/lib/api";

export function SiteHeader() {
  const { userId } = useAuth();
  const { openAuth } = useAuthDialog();
  const navigate = useNavigate();

  async function handleSignOut() {
    try {
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="text-lg font-extrabold tracking-tight">
          <span className="text-primary">Doing</span>Good
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            to="/"
            className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            Browse items
          </Link>
          <Link
            to="/how-it-works"
            className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground md:block"
          >
            How it works
          </Link>
          <Link
            to="/our-story"
            className="hidden px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:block"
          >
            Our story
          </Link>
          {userId ? (
            <>
              <Link
                to="/dashboard"
                className="px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => openAuth({ mode: "signin" })}
              className="px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </button>
          )}
          {userId ? (
            <Button asChild variant="hero" size="sm">
              <Link to="/give">Give an item</Link>
            </Button>
          ) : (
            <Button
              variant="hero"
              size="sm"
              onClick={() => openAuth({ mode: "signin", next: "/give" })}
            >
              Give an item
            </Button>
          )}
        </nav>
      </div>
      <nav
        aria-label="Explore"
        className="flex justify-center gap-6 border-t border-border px-4 py-3 text-xs font-medium text-muted-foreground md:hidden"
      >
        <Link to="/">Browse items</Link>
        <Link to="/how-it-works">How it works</Link>
        <Link to="/our-story">Our story</Link>
      </nav>
    </header>
  );
}
