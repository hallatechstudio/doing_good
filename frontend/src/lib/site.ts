export const CATEGORIES = [
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "appliances", label: "Appliances" },
  { value: "kitchen", label: "Kitchen" },
  { value: "books", label: "Books" },
  { value: "baby", label: "Baby & Kids" },
  { value: "electronics", label: "Electronics" },
  { value: "other", label: "Other" },
] as const;

export const CONDITIONS = [
  { value: "like-new", label: "Like new" },
  { value: "good", label: "Good" },
  { value: "gently-used", label: "Gently used" },
  { value: "needs-repair", label: "Needs repair" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  pending: "On hold",
  matched: "Matched",
  given: "Given",
};

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function conditionLabel(value: string) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}
