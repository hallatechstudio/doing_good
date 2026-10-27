import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPassword,
  register,
  resetPassword,
  signIn,
  updateProfile,
  type Profile,
} from "@/lib/api";

export type AuthMode = "signin" | "signup" | "forgot" | "reset";
export const AUTH_HEADINGS: Record<AuthMode, string> = {
  signin: "Welcome back",
  signup: "Create your account",
  forgot: "Reset your password",
  reset: "Choose a new password",
};
export function AuthForm({
  initialMode = "signin",
  resetToken = "",
  header,
  onDone,
  onResetCleared,
}: {
  initialMode?: AuthMode;
  resetToken?: string;
  header?: (view: { title: string; description: string }) => ReactNode;
  onDone: () => void;
  onResetCleared?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(resetToken ? "reset" : initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [fullName, setFullName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  function changeMode(next: AuthMode) {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setNotice("");
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (profile) {
        await updateProfile(fullName || profile.full_name, phone);
        onDone();
      } else if (mode === "forgot") {
        const response = await forgotPassword(email);
        setNotice(response.message);
      } else if (mode === "reset") {
        if (password !== confirmation) throw new Error("Passwords do not match.");
        await resetPassword(resetToken, password);
        changeMode("signin");
        setNotice("Your password has been saved. Sign in with your email and new password.");
        onResetCleared?.();
      } else {
        if (mode === "signup" && password !== confirmation)
          throw new Error("Passwords do not match.");
        const signedIn =
          mode === "signup"
            ? await register(email, password, fullName)
            : await signIn(email, password);
        setPassword("");
        setConfirmation("");
        if (!/^\+[1-9]\d{7,14}$/.test(signedIn.phone)) {
          setProfile(signedIn);
          setFullName(signedIn.full_name);
        } else onDone();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete your request.");
    } finally {
      setBusy(false);
    }
  }
  const title = profile ? "Add your WhatsApp number" : AUTH_HEADINGS[mode];
  const description = profile
    ? "Add your contact details so people can reach you about your listings."
    : mode === "forgot"
      ? "Enter your email and we will send you a password reset link."
      : mode === "reset"
        ? "Choose a password with at least 12 characters."
        : mode === "signup"
          ? "Create an account to give items you no longer need and to request items you do."
          : "Sign in with your email and password.";
  return (
    <>
      {header ? (
        header({ title, description })
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="mt-3 text-muted-foreground">{description}</p>
        </>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      <form onSubmit={submit} className="mt-8 space-y-5">
        {(profile || mode === "signup") && (
          <div className="space-y-2">
            <Label htmlFor="auth-name">Full name</Label>
            <Input
              id="auth-name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
        )}
        {profile ? (
          <div className="space-y-2">
            <Label htmlFor="auth-whatsapp">WhatsApp number</Label>
            <Input
              id="auth-whatsapp"
              type="tel"
              autoComplete="tel"
              required
              minLength={9}
              maxLength={20}
              placeholder="+2348012345678"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Include your country code. This number will be visible on your listings so people can
              contact you on WhatsApp.
            </p>
          </div>
        ) : (
          <>
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="auth-email">Email</Label>
                <Input
                  id="auth-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}
            {mode !== "forgot" && (
              <div className="space-y-2">
                <Label htmlFor="auth-password">
                  {mode === "reset" ? "New password" : "Password"}
                </Label>
                <Input
                  id="auth-password"
                  type="password"
                  required
                  minLength={mode === "signin" ? 1 : 12}
                  maxLength={128}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {mode === "signup" && (
                  <p className="text-sm text-muted-foreground">Use at least 12 characters.</p>
                )}
              </div>
            )}
            {(mode === "signup" || mode === "reset") && (
              <div className="space-y-2">
                <Label htmlFor="auth-confirm">Confirm password</Label>
                <Input
                  id="auth-confirm"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            )}
          </>
        )}
        {!profile && mode === "signup" && (
          <p className="text-xs leading-5 text-muted-foreground">
            By creating an account, you agree to our{" "}
            <Link
              to="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Terms of Use
            </Link>
            . Read our{" "}
            <Link
              to="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Privacy Policy
            </Link>{" "}
            to learn how we handle your information. Both links open in a new tab.
          </p>
        )}
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : profile
              ? "Save and continue"
              : mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Save new password"
                    : "Sign in"}
        </Button>
      </form>
      {!profile && (
        <div className="mt-6 space-y-3 text-center text-sm">
          {mode === "signin" ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => changeMode("forgot")}
                className="text-primary hover:underline"
              >
                Forgot password?
              </button>
              <p className="text-muted-foreground">
                New to DoingGood?{" "}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => changeMode("signup")}
                  className="text-primary hover:underline"
                >
                  Create an account
                </button>
              </p>
            </>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => changeMode("signin")}
              className="text-primary hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
      )}
    </>
  );
}
