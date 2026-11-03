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
  status: string;
  price_kobo?: number;
  created_at: string;
};
