export interface StockItem {
  id?: string;
  code?: string;
  image: string;
  label?: string;
  category?: string;
  color?: string;
  pattern?: string;
  fabric?: string;
  price?: number;
  notes?: string;
  ai_description?: string;
  status: "in_stock" | "sold";
  sold_at?: string;
  buyer_name?: string;
  buyer_phone?: string;
  created_at?: string;
  updated_at?: string;
}
