import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Moon, ShoppingCart, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useCart } from "@/lib/cart";
import { signOut } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";

export function SiteHeader() {
  const { userId, user } = useAuth();
  const { ids } = useCart();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  async function handleSignOut() {
    try {
      await signOut();
      void navigate("/auth", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign out.");
    }
  }
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-1 px-4 py-2 sm:gap-2 sm:px-6">
        <Link to="/" className="shrink-0 text-base font-extrabold tracking-tight sm:text-lg">
          <span className="text-primary">Doing</span>Good
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-0.5 sm:gap-2 lg:gap-3">
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
          <Button asChild size="sm" variant="outline" className="h-9 px-2 sm:px-3">
            <Link to="/cart" aria-label={`View cart (${ids.length} items)`}>
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">Cart</span>
              <span>{ids.length}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="size-9" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          {userId ? (
            <>
              <Button asChild variant="ghost" size="icon" aria-label={`Open ${user?.full_name || "your"} profile`} title="Profile">
                <Link to="/dashboard"><UserRound className="size-4" /></Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Log out">
                <LogOut className="size-4" /> <span className="hidden sm:inline">Log out</span>
              </Button>
            </>
          ) : (
            <Link
              to="/auth"
              className="px-1 text-xs font-medium text-muted-foreground hover:text-foreground sm:px-2 sm:text-sm"
            >
              Sign in
            </Link>
          )}
          <Button asChild variant="hero" size="sm" className="h-9 whitespace-nowrap px-2 text-xs sm:px-3 sm:text-sm">
            <Link to="/give">Give an item</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
