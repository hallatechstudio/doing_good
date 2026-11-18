import { useEffect, useState } from "react";
import { Upload, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Item } from "@/lib/types";
import { commerceSettings, photoData, updateListing } from "@/lib/api";
import { CATEGORIES, CONDITIONS } from "@/lib/site";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type PhotoEntry = { kind: "existing"; value: string } | { kind: "new"; value: File };

export function EditListingDialog({
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  item: Item;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [paidListingsAvailable, setPaidListingsAvailable] = useState(false);
  const [pricing, setPricing] = useState((item.price_kobo ?? 0) > 0 ? "paid" : "free");
  const [handoff, setHandoff] = useState(() => {
    if ((item.price_kobo ?? 0) === 0) return "pickup";
    const pickup = item.pickup_available !== false;
    const delivery = item.delivery_area !== null && item.delivery_area !== undefined;
    if (pickup && delivery) return "both";
    if (delivery) return "delivery";
    return "pickup";
  });
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setPricing((item.price_kobo ?? 0) > 0 ? "paid" : "free");
    const pickup = item.pickup_available !== false;
    const delivery = item.delivery_area !== null && item.delivery_area !== undefined;
    setHandoff(pickup && delivery ? "both" : delivery ? "delivery" : "pickup");
    setPhotos(item.photos.map((url) => ({ kind: "existing", value: url })));
    setPreviews(item.photos);
    let active = true;
    void commerceSettings()
      .then(() => {
        if (active) setPaidListingsAvailable(true);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [open, item]);

  useEffect(() => {
    const urls = photos.map((p) =>
      p.kind === "existing" ? p.value : URL.createObjectURL(p.value),
    );
    setPreviews(urls);
    return () => {
      photos.forEach((p, i) => {
        if (p.kind === "new") URL.revokeObjectURL(urls[i]!);
      });
    };
  }, [photos]);

  function addPhotoFiles(files: FileList | null) {
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
    setPhotos((previous) => [
      ...previous,
      ...selected.map((file) => ({ kind: "new" as const, value: file })),
    ]);
  }

  function removePhoto(index: number) {
    setPhotos((previous) => previous.filter((_, i) => i !== index));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!photos.length) {
      toast.error("Keep at least one photo of your item.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const newImages = await Promise.all(
        photos
          .filter((p): p is { kind: "new"; value: File } => p.kind === "new")
          .map((p) => photoData(p.value)),
      );
      let newIndex = 0;
      const photoPayload = photos.map((p) =>
        p.kind === "existing" ? p.value : newImages[newIndex++]!,
      );
      const priceKobo = pricing === "paid" ? Math.round(Number(form.get("price")) * 100) : 0;
      const deliveryEnabled = pricing === "paid" && handoff !== "pickup";
      await updateListing(item.id, {
        title: String(form.get("title")).trim(),
        description: String(form.get("description")).trim(),
        category: String(form.get("category")),
        condition: String(form.get("condition")),
        location: String(form.get("location")).trim(),
        photos: photoPayload,
        quantity: Math.floor(Number(form.get("quantity"))),
        price_kobo: priceKobo,
        pickup_available: pricing !== "paid" || handoff !== "delivery",
        delivery_fee_kobo: deliveryEnabled
          ? Math.round(Number(form.get("delivery_fee")) * 100)
          : null,
        delivery_area: deliveryEnabled ? String(form.get("delivery_area")).trim() : null,
      });
      toast.success("Listing updated.");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this listing.");
    } finally {
      setBusy(false);
    }
  }

  const selectClass = "h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <Pencil className="size-5 text-primary" />
          Edit listing
        </DialogTitle>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Item title</Label>
            <Input
              id="edit-title"
              name="title"
              required
              minLength={3}
              maxLength={150}
              defaultValue={item.title}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-quantity">Quantity available</Label>
            <Input
              id="edit-quantity"
              name="quantity"
              type="number"
              required
              min="0"
              max="10000"
              defaultValue={item.quantity ?? 1}
            />
            <p className="text-xs text-muted-foreground">Set this to 0 to mark the item out of stock. Add stock here whenever you have more.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              name="description"
              required
              minLength={10}
              maxLength={5000}
              rows={4}
              defaultValue={item.description}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <select
                id="edit-category"
                name="category"
                className={selectClass}
                required
                defaultValue={item.category}
              >
                <option value="">Choose a category</option>
                {CATEGORIES.map((value) => (
                  <option key={value.value} value={value.value}>
                    {value.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-condition">Condition</Label>
              <select
                id="edit-condition"
                name="condition"
                className={selectClass}
                required
                defaultValue={item.condition}
              >
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
            <Label htmlFor="edit-location">Location in Lagos</Label>
            <Input
              id="edit-location"
              name="location"
              required
              minLength={2}
              maxLength={150}
              defaultValue={item.location}
            />
          </div>
          <fieldset
            disabled={busy}
            className="space-y-4 rounded-xl border border-border bg-card p-4"
          >
            <Label htmlFor="edit-type">Give away or offer for an amount?</Label>
            <select
              id="edit-type"
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
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Item amount (₦)</Label>
                  <Input
                    id="edit-price"
                    name="price"
                    type="number"
                    required
                    min="100"
                    max="1000000"
                    step="0.01"
                    defaultValue={(item.price_kobo ?? 0) / 100 || 0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-handoff">Pickup and delivery options</Label>
                  <select
                    id="edit-handoff"
                    value={handoff}
                    onChange={(event) => setHandoff(event.target.value)}
                    className={selectClass}
                  >
                    <option value="pickup">Pickup only</option>
                    <option value="delivery">Delivery only</option>
                    <option value="both">Pickup or delivery</option>
                  </select>
                </div>
                {handoff !== "pickup" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-delivery-area">Delivery areas</Label>
                      <Input
                        id="edit-delivery-area"
                        name="delivery_area"
                        required
                        minLength={2}
                        maxLength={150}
                        defaultValue={item.delivery_area ?? ""}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-delivery-fee">Fixed delivery fee (₦)</Label>
                      <Input
                        id="edit-delivery-fee"
                        name="delivery_fee"
                        type="number"
                        required
                        min="0"
                        max="100000"
                        step="0.01"
                        defaultValue={(item.delivery_fee_kobo ?? 0) / 100 || 0}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </fieldset>
          <div className="space-y-2">
            <Label>Photos</Label>
            <p className="text-sm text-muted-foreground">Up to 5 photos · keep at least one</p>
            <div className="flex flex-wrap gap-3">
              {previews.map((url, index) => (
                <div key={url} className="relative">
                  <img
                    src={url}
                    alt={"Item photo " + (index + 1)}
                    className="size-24 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(index)}
                    aria-label={"Remove photo " + (index + 1)}
                    className="absolute right-1 top-1 rounded-full bg-black/80 p-1"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <label
              htmlFor="edit-photos"
              className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 p-6 text-primary"
            >
              <Upload className="size-5" /> Add photos
            </label>
            <input
              id="edit-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(event) => {
                addPhotoFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
