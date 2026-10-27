import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { currentUser, AUTH_EVENT } from "./api";
const AuthContext = createContext<{ userId: string | null; loading: boolean }>({
  userId: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const sync = () => {
      const current = ++generation;
      void currentUser()
        .then((profile) => {
          if (active && current === generation) setUserId(profile?.id ?? null);
        })
        .catch(() => {
          if (active && current === generation) setUserId(null);
        })
        .finally(() => {
          if (active && current === generation) setLoading(false);
        });
    };
    sync();
    const authChanged = (event: Event) => {
      if (event instanceof CustomEvent) {
        generation++;
        setUserId(event.detail?.id ?? null);
        setLoading(false);
      } else sync();
    };
    window.addEventListener(AUTH_EVENT, authChanged);
    window.addEventListener("focus", sync);
    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, authChanged);
      window.removeEventListener("focus", sync);
    };
  }, []);
  return <AuthContext.Provider value={{ userId, loading }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
