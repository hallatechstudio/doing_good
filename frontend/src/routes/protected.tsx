import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
export function ProtectedLayout() {
  const { userId, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <p role="status" className="px-4 py-24 text-center text-muted-foreground">
        Checking your session…
      </p>
    );
  if (!userId)
    return (
      <Navigate
        to={"/auth?next=" + encodeURIComponent(location.pathname + location.search)}
        replace
      />
    );
  return <Outlet />;
}
