import { supabase, isSupabaseClient } from "./client";
import { StockItem } from "@/types/stock-item";

// Supabase/PostgREST returns at most 1000 rows per request. Once the shop has
// more than 1000 sarees, a single query silently drops the rest — so we page
// through in blocks of 1000 and return everything.
export async function getStockItems(statusFilter?: string) {
  if (!isSupabaseClient(supabase)) return [];

  const pageSize = 1000;
  const all: StockItem[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("stock_items")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data as StockItem[]) || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }

  return all;
}
