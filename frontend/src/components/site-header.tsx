import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { signOut } from "@/lib/api";

export function SiteHeader() {
  const { userId } = useAuth();
  const { ids } = useCart();
  const navigate = useNavigate();
  async function handleSignOut() {
    try {
      await signOut();
      void navigate("/auth", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <Link to="/" className="shrink-0 text-lg font-extrabold tracking-tight">
          <span className="text-primary">Doing</span>Good
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2 lg:gap-3">
          {!userId && (
            <Link
              to="/"
              className="hidden px-2 text-sm text-muted-foreground hover:text-foreground lg:block"
            >
              Browse items
            </Link>
          )}
          <Link
            to="/how-it-works"
            className="hidden px-2 text-sm text-muted-foreground hover:text-foreground lg:block"
          >
            How it works
          </Link>
          {userId && (
            <Link to="/wallet" className="hidden px-2 text-sm text-muted-foreground hover:text-foreground lg:block">
              Wallet
            </Link>
          )}
          {userId && (
            <Link
              to="/orders"
              className="hidden px-2 text-sm text-muted-foreground hover:text-foreground lg:block"
            >
              Order history
            </Link>
          )}
          {userId && (
            <Link
              to="/dashboard"
              className="hidden px-2 text-sm text-muted-foreground hover:text-foreground lg:block"
            >
              My listings
            </Link>
          )}
          <Button asChild size="sm" variant="outline" className="px-2 sm:px-3">
            <Link to="/cart" aria-label={`View cart (${ids.length} items)`}>
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">Cart</span>
              <span>{ids.length}</span>
            </Link>
          </Button>
          {userId ? (
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          ) : (
            <Link
              to="/auth"
              className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-2 sm:text-sm"
            >
              Sign in
            </Link>
          )}
          <Button asChild variant="hero" size="sm" className="px-2 sm:px-3">
            <Link to="/give">Give an item</Link>
          </Button>
        </nav>
      </div>
      <nav
        aria-label="Explore"
        className="flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-border px-4 py-3 text-xs font-medium text-muted-foreground lg:hidden"
      >
        {!userId && <Link to="/">Browse items</Link>}
        <Link to="/how-it-works">How it works</Link>
        {userId && <Link to="/dashboard">My listings</Link>}
        {userId && <Link to="/wallet">Wallet</Link>}
        {userId && <Link to="/orders">Order history</Link>}
      </nav>
    </header>
  );
}
