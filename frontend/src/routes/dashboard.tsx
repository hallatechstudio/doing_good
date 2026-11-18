import { useState } from "react";
import { Link, redirect, useLoaderData, useRevalidator } from "react-router-dom";
import { Plus, Package, UserRound, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ApiError, getDashboard, updateProfile } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditListingDialog } from "@/components/edit-listing-dialog";
import type { Item } from "@/lib/types";
export async function dashboardLoader() {
  try {
    return await getDashboard();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      throw redirect("/auth?next=%2Fdashboard");
    throw error;
  }
}
export function DashboardPage() {
  const data = useLoaderData() as Awaited<ReturnType<typeof dashboardLoader>>;
  const revalidator = useRevalidator();
  const [tab, setTab] = useState(data.profile.phone ? "listings" : "profile");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await updateProfile(String(form.get("phone")).trim());
      toast.success("Profile saved. You can now list items.");
      await revalidator.revalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-20">
      <title>My dashboard - DoingGood</title>
      <p className="eyebrow text-primary">Your corner of good</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold">
            Hello{data.profile.full_name ? ", " + data.profile.full_name.split(" ")[0] : " there"}.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Manage your listings and WhatsApp contact details.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link to="/cart">View cart</Link>
          </Button>
          <Button asChild variant="hero">
            <Link to="/give">
              <Plus className="size-4" />
              Give an item
            </Link>
          </Button>
        </div>
      </div>
      {!data.profile.phone && (
        <p role="status" className="mt-6 rounded-lg border border-primary/20 bg-primary/10 p-4">
          Add your WhatsApp number below so people can contact you about items you list.
        </p>
      )}
      <div
        role="tablist"
        aria-label="Dashboard"
        className="mt-10 flex gap-2 border-b border-border pb-3"
      >
        {[
          { id: "listings", label: "My listings", icon: Package },
          { id: "profile", label: "Profile", icon: UserRound },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={"tab-" + id}
            role="tab"
            aria-selected={tab === id}
            aria-controls="dashboard-panel"
            onClick={() => setTab(id)}
            className={
              "inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium " +
              (tab === id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      <div id="dashboard-panel" role="tabpanel" aria-labelledby={"tab-" + tab} className="mt-8">
        {tab === "listings" && (
          <div className="space-y-5">
            {!data.listings.length && (
              <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center">
                <h2 className="text-xl font-semibold">Your next act of good starts here.</h2>
                <p className="mt-3 text-muted-foreground">
                  Give something you no longer need. Your first listing will appear here.
                </p>
              </div>
            )}
            {data.listings.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-card p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={item.photos[0] ?? "/images/sofa.jpg"}
                    alt={item.title}
                    className="size-20 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={"/items/" + item.id}
                      className="text-lg font-semibold hover:text-primary"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">{item.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => setEditing(item)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm">
                      <span className={item.quantity === 0 ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                        {item.quantity === 0 ? "Out of Stock" : `${item.quantity ?? 1} in stock`}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {tab === "profile" && (
          <form
            key={data.profile.id}
            onSubmit={saveProfile}
            className="max-w-lg space-y-5 rounded-xl border border-border bg-card p-6"
          >
            <h2 className="text-xl font-semibold">Your profile</h2>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">WhatsApp number</Label>
              <Input
                id="profile-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                minLength={9}
                maxLength={20}
                placeholder="+2348012345678"
                defaultValue={data.profile.phone}
              />
              <p className="text-sm text-muted-foreground">
                Include your country code. Changing this number may prevent messages or payouts for active transactions from reaching you.
              </p>
            </div>
            <Button variant="hero" disabled={busy}>
              {busy ? "Saving…" : "Save profile"}
            </Button>
          </form>
        )}
      </div>
      {editing && (
        <EditListingDialog
          item={editing}
          open={true}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => {
            void revalidator.revalidate();
          }}
        />
      )}
    </div>
  );
}
