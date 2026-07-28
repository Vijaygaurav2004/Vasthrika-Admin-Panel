import { supabase, isSupabaseClient } from "./client";
import { StockItem } from "@/types/stock-item";

export async function getStockItems(statusFilter?: string) {
  if (!isSupabaseClient(supabase)) return [];

  let query = supabase
    .from("stock_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as StockItem[];
}
