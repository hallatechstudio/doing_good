import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestCode, verifyCode, updateProfile, type Profile } from "@/lib/api";
export function AuthPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [verifiedProfile, setVerifiedProfile] = useState<Profile | null>(null);
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function finish() {
    const next = params.get("next");
    await navigate(
      next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
        ? next
        : "/dashboard",
    );
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (verifiedProfile) {
        await updateProfile(fullName || verifiedProfile.full_name, phone);
        await finish();
      } else if (!sent) {
        await requestCode(email, fullName || undefined);
        setSent(true);
        toast.success("Check your email for your sign-in code.");
      } else {
        const profile = await verifyCode(email, code);
        if (!/^\+[1-9]\d{7,14}$/.test(profile.phone)) {
          setVerifiedProfile(profile);
          setFullName(profile.full_name);
        } else await finish();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 sm:py-24">
      <title>Sign in - DoingGood</title>
      <h1 className="text-3xl font-extrabold">Welcome back</h1>
      <p className="mt-3 text-muted-foreground">
        Sign in with an email code, then add your WhatsApp number to list items.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {verifiedProfile ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="onboard-name">Full name</Label>
              <Input
                id="onboard-name"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="onboard-whatsapp">WhatsApp number</Label>
              <Input
                id="onboard-whatsapp"
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
                Include your country code. This number will be visible on your listings so people
                can contact you on WhatsApp.
              </p>
            </div>
          </>
        ) : !sent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="auth-name">Full name (for new accounts)</Label>
              <Input
                id="auth-name"
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Code sent to {email}. It expires in 10 minutes.
            </p>
            <Label htmlFor="auth-code">Six-digit code</Label>
            <Input
              id="auth-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" variant="hero" className="w-full" disabled={busy}>
          {busy
            ? "Please wait…"
            : verifiedProfile
              ? "Save and continue"
              : sent
                ? "Verify and sign in"
                : "Email me a code"}
        </Button>
        {sent && !verifiedProfile && (
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setSent(false);
              setCode("");
            }}
          >
            Change email or request a new code
          </Button>
        )}
      </form>
    </div>
  );
}
