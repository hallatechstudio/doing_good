import {
  Link,
  Outlet,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { AuthDialogProvider } from "@/components/auth-dialog";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function NotFoundPage() {
  return (
    <div className="px-4 py-24 text-center">
      <h1 className="text-7xl font-extrabold">404</h1>
      <h2 className="mt-4 text-xl">Page not found</h2>
      <p className="mt-2 text-muted-foreground">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="mt-6 inline-block text-primary">
        Go home
      </Link>
    </div>
  );
}

export function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  return (
    <div role="alert" className="px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">This page didn't load</h1>
      <p className="mt-2 text-muted-foreground">
        {error instanceof Error ? error.message : "Something went wrong. Please try again."}
      </p>
      <button className="mt-6 text-primary" onClick={() => window.location.reload()}>
        Try again
      </button>
      <Link to="/" className="ml-4 text-primary">
        Go home
      </Link>
    </div>
  );
}

export function RootLayout() {
  return (
    <AuthProvider>
      <AuthDialogProvider>
        <div className="flex min-h-screen flex-col bg-background font-sans text-foreground">
          <SiteHeader />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
        <Toaster />
        <ScrollRestoration />
      </AuthDialogProvider>
    </AuthProvider>
  );
}
