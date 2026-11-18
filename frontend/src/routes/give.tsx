import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CONDITIONS } from "@/lib/site";
import { addListing, photoData, currentUser, commerceSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function GivePage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [pricing, setPricing] = useState("free");
  const [handoff, setHandoff] = useState("pickup");
  const [paidListingsAvailable, setPaidListingsAvailable] = useState(false);
  useEffect(() => {
    let active = true;
    void commerceSettings()
      .then(() => {
        if (active) setPaidListingsAvailable(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    void currentUser()
      .then((profile) => {
        if (active) setPhone(profile?.phone || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const urls = photos.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);
  function addPhotos(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (photos.length + selected.length > 5) {
      toast.error("Choose up to five photos.");
      return;
    }
    if (
      selected.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024,
      )
    ) {
      toast.error("Use JPG, PNG or WebP images, up to 5 MB each.");
      return;
    }
    setPhotos((previous) => [...previous, ...selected]);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;
    if (!photos.length) {
      toast.error("Add at least one photo of your item.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const images = await Promise.all(photos.map(photoData));
      await addListing({
        whatsapp: phone,
        quantity: Math.floor(Number(form.get("quantity"))),
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim(),
        category: String(form.get("category")),
        condition: String(form.get("condition")),
        location: String(form.get("location")).trim(),
        photos: images,
        price_kobo: pricing === "paid" ? Math.round(Number(form.get("price")) * 100) : 0,
        pickup_available: pricing !== "paid" || handoff !== "delivery",
        delivery_fee_kobo:
          pricing === "paid" && handoff !== "pickup"
            ? Math.round(Number(form.get("delivery_fee")) * 100)
            : null,
        delivery_area:
          pricing === "paid" && handoff !== "pickup"
            ? String(form.get("delivery_area")).trim()
            : null,
      });
      toast.success("Your item is listed.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not list this item. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:py-20">
      <title>Give an item - DoingGood</title>
      <HeartHandshake className="size-8 text-primary" />
      <p className="eyebrow mt-6 text-primary">Make room for good</p>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">
        Something you no longer need.
        <br />
        <span className="text-primary">A new beginning for someone.</span>
      </h1>
      <p className="mt-4 text-muted-foreground">
        Give your item away or set an amount in naira. Listing is free. Receivers of paid items use
        platform checkout. People can contact givers on WhatsApp for free items.
      </p>
      <form onSubmit={submit} className="mt-10 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="listing-whatsapp">WhatsApp number</Label>
          <Input
            id="listing-whatsapp"
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
            Include your country code. People will contact this number directly from your listings.
          </p>
        </div>
        <fieldset disabled={busy} className="space-y-6 disabled:opacity-60">
          <div className="space-y-3 rounded-xl border border-border bg-card p-5">
            <Label htmlFor="listing-type">Give away or offer for an amount?</Label>
            <select
              id="listing-type"
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className={selectClass}
            >
              <option value="free">Free item — give it away</option>
              <option value="paid" disabled={!paidListingsAvailable}>
                Paid item — set an amount
              </option>
            </select>
            {pricing === "paid" && (
              <>
                <Label htmlFor="listing-price">Item amount (₦)</Label>
                <Input
                  id="listing-price"
                  name="price"
                  type="number"
                  required
                  min="100"
                  max="1000000"
                  step="0.01"
                  placeholder="e.g. 25000"
                />
                <Label htmlFor="listing-handoff">Pickup and delivery options</Label>
                <select
                  id="listing-handoff"
                  className={selectClass}
                  value={handoff}
                  onChange={(event) => setHandoff(event.target.value)}
                >
                  <option value="pickup">Pickup only</option>
                  <option value="delivery">Delivery only</option>
                  <option value="both">Pickup or delivery</option>
                </select>
                {handoff !== "pickup" && (
                  <>
                    <Label htmlFor="delivery-area">Delivery areas</Label>
                    <Input
                      id="delivery-area"
                      name="delivery_area"
                      required
                      minLength={2}
                      maxLength={150}
                      placeholder="e.g. Yaba and Surulere"
                    />
                    <Label htmlFor="delivery-fee">Fixed delivery fee (₦)</Label>
                    <Input
                      id="delivery-fee"
                      name="delivery_fee"
                      type="number"
                      required
                      min="0"
                      max="100000"
                      step="0.01"
                      placeholder="0 for free delivery"
                    />
                    <p className="text-sm text-muted-foreground">
                      This fee is added to the checkout total when the receiver chooses delivery.
                    </p>
                  </>
                )}
              </>
            )}
          </div>
          <div>
            <Label htmlFor="photos">Photos</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Up to 5 photos · JPG, PNG or WebP · 5 MB each
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {previews.map((url, index) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt={"Item photo " + (index + 1)}
                    className="size-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos(photos.filter((_, i) => i !== index))}
                    aria-label={"Remove photo " + (index + 1)}
                    className="absolute right-1 top-1 rounded-full bg-black/80 p-1"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <label
              htmlFor="photos"
              className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 p-8 text-primary"
            >
              <Upload className="size-5" /> Add photos
            </label>
            <input
              id="photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Item title</Label>
            <Input
              id="title"
              name="title"
              required
              minLength={3}
              maxLength={120}
              placeholder="e.g. A well-loved three-seater sofa"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity available</Label>
            <Input
              id="quantity"
              name="quantity"
              type="number"
              required
              min="1"
              max="10000"
              defaultValue="1"
            />
            <p className="text-xs text-muted-foreground">
              List how many units you have. Each collection reduces the remaining quantity by one.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              required
              minLength={10}
              maxLength={2000}
              rows={5}
              placeholder="Tell us about the item, its size and any signs of use."
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select id="category" name="category" className={selectClass} required>
                <option value="">Choose a category</option>
                {CATEGORIES.map((value) => (
                  <option key={value.value} value={value.value}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <select id="condition" name="condition" className={selectClass} required>
                <option value="">Choose the condition</option>
                {CONDITIONS.map((value) => (
                  <option key={value.value} value={value.value}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location in Lagos</Label>
            <Input
              id="location"
              name="location"
              required
              minLength={2}
              maxLength={150}
              placeholder="e.g. Yaba, Lagos"
            />
            <p className="text-xs text-muted-foreground">
              Your neighbourhood is enough. Keep your full address private.
            </p>
          </div>
          <Button type="submit" variant="hero" size="lg" className="w-full">
            {busy
              ? "Uploading and listing…"
              : pricing === "paid"
                ? "List my item for receivers"
                : "List my free item"}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
