import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, CONDITIONS } from "@/lib/site";
import { addListing, photoData, currentUser } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function GivePage() {
  const { userId } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
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
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim(),
        category: String(form.get("category")),
        condition: String(form.get("condition")),
        location: String(form.get("location")).trim(),
        photos: images,
      });
      toast.success("Your item is listed. Thank you for giving!");
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
        List your item for free. People can contact you on WhatsApp to arrange collection.
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
            {busy ? "Uploading and listing…" : "List my item for free"}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
