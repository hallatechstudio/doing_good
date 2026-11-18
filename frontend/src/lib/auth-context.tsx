import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { currentUser, AUTH_EVENT, type Profile } from "./api";
const AuthContext = createContext<{ userId: string | null; user: Profile | null; loading: boolean }>({
  userId: null,
  user: null,
  loading: true,
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    let generation = 0;
    const sync = () => {
      const current = ++generation;
      void currentUser()
        .then((profile) => {
          if (active && current === generation) {
            setUserId(profile?.id ?? null);
            setUser(profile);
          }
        })
        .catch(() => {
          if (active && current === generation) {
            setUserId(null);
            setUser(null);
          }
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
        setUser(event.detail ?? null);
        setLoading(false);
      } else sync();
    };
    window.addEventListener(AUTH_EVENT, authChanged);
    return () => {
      active = false;
      window.removeEventListener(AUTH_EVENT, authChanged);
    };
  }, []);
  return <AuthContext.Provider value={{ userId, user, loading }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  return useContext(AuthContext);
}
