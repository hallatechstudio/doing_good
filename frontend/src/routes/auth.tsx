import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthForm, AUTH_HEADINGS, type AuthMode } from "@/components/auth-form";

export function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resetToken = params.get("reset") || "";
  const mode: AuthMode = resetToken
    ? "reset"
    : params.get("mode") === "signup"
      ? "signup"
      : "signin";
  const next = params.get("next");
  return (
    <div className="mx-auto my-6 max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain px-4 py-6 sm:my-10 sm:py-8">
      <title>{AUTH_HEADINGS[mode]} - DoingGood</title>
      <AuthForm
        initialMode={mode}
        resetToken={resetToken}
        onDone={() =>
          void navigate(
            next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
              ? next
              : "/dashboard",
          )
        }
        onResetCleared={() => void navigate("/auth", { replace: true })}
      />
    </div>
  );
}
