import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AuthForm, type AuthMode } from "@/components/auth-form";

type AuthRequest = { mode: AuthMode; next?: string; onSuccess?: () => void };
const AuthDialogContext = createContext<{ openAuth: (request?: AuthRequest) => void }>({
  openAuth: () => {},
});
export function useAuthDialog() {
  return useContext(AuthDialogContext);
}
export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [request, setRequest] = useState<(AuthRequest & { key: number }) | null>(null);
  const openAuth = useCallback((options: AuthRequest = { mode: "signin" }) => {
    setRequest({ ...options, key: Math.random() });
  }, []);
  return (
    <AuthDialogContext.Provider value={{ openAuth }}>
      {children}
      {request && (
        <Dialog open onOpenChange={(open) => !open && setRequest(null)}>
          <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-hidden rounded-lg p-0">
            <div className="max-h-[85dvh] min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 pt-10">
              <AuthForm
                key={request.key}
                initialMode={request.mode}
                header={({ title, description }) => (
                  <>
                    <DialogTitle className="text-2xl font-extrabold">{title}</DialogTitle>
                    <DialogDescription className="mt-2">{description}</DialogDescription>
                  </>
                )}
                onDone={() => {
                  const { next, onSuccess } = request;
                  setRequest(null);
                  onSuccess?.();
                  if (next) void navigate(next);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AuthDialogContext.Provider>
  );
}
