export type Item = {
  id: string;
  owner_id: string;
  donor_name: string | null;
  donor_whatsapp: string;
  title: string;
  description: string;
  category: string;
  condition: string;
  location: string;
  photos: string[];
  quantity?: number;
  status: string;
  price_kobo?: number;
  pickup_available?: boolean;
  delivery_fee_kobo?: number | null;
  delivery_area?: string | null;
  created_at: string;
};
