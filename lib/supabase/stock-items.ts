import { supabase, isSupabaseClient } from "./client";
import { StockItem } from "@/types/stock-item";

// Highest number already used for a given code prefix (e.g. "BYR02" -> 62),
// so QR label printing can continue from there instead of restarting at 1.
export async function getMaxCodeNumber(prefix: string): Promise<number> {
  const p = prefix.trim().toUpperCase();
  if (!isSupabaseClient(supabase) || !p) return 0;
  const { data, error } = await supabase
    .from("stock_items")
    .select("code")
    .ilike("code", `${p}-%`)
    .order("code", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return 0;
  const num = parseInt((data[0].code as string).split("-").pop() || "", 10);
  return Number.isNaN(num) ? 0 : num;
}

// For bulk add: the prefix + next number to continue from, based on the codes
// already in that folder.
export async function getFolderCodeInfo(category: string): Promise<{ prefix: string; next: number }> {
  if (!isSupabaseClient(supabase) || !category) return { prefix: "", next: 1 };
  const { data, error } = await supabase
    .from("stock_items")
    .select("code")
    .eq("category", category)
    .not("code", "is", null)
    .order("code", { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return { prefix: "", next: 1 };
  const code = data[0].code as string;
  const idx = code.lastIndexOf("-");
  if (idx < 0) return { prefix: code, next: 1 };
  const prefix = code.slice(0, idx);
  const num = parseInt(code.slice(idx + 1), 10);
  return { prefix, next: Number.isNaN(num) ? 1 : num + 1 };
}

// Recently registered codes for a prefix — powers the "QR history" list so you
// can see which codes are already used before printing more.
export async function getRecentCodesByPrefix(prefix: string, limit = 60): Promise<StockItem[]> {
  const p = prefix.trim().toUpperCase();
  if (!isSupabaseClient(supabase) || !p) return [];
  const { data, error } = await supabase
    .from("stock_items")
    .select("code,category,status,created_at,created_by")
    .ilike("code", `${p}-%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as unknown as StockItem[]) || [];
}

// Change a saree's QR code (for fixing a wrong/accidental scan). Throws a clear
// message if the new code is already used by another saree.
export async function updateItemCode(id: string, newCode: string): Promise<void> {
  if (!isSupabaseClient(supabase)) throw new Error("Database unavailable");
  const code = newCode.trim();
  const { error } = await supabase
    .from("stock_items")
    .update({ code: code || null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error(`Code "${code}" is already used by another saree.`);
    throw new Error(error.message || "Failed to update code");
  }
}

// Supabase/PostgREST returns at most 1000 rows per request. Once the shop has
// more than 1000 sarees, a single query silently drops the rest — so we page
// through in blocks of 1000 and return everything.
//
// We skip the heavy `ai_description` column here: none of the list/folder
// screens use it, and it roughly triples the payload at scale.
const LIST_COLUMNS =
  "id,code,image,label,category,color,pattern,fabric,price,notes,status,sold_at,buyer_name,buyer_phone,created_by,sold_by,created_at,updated_at";

export async function getStockItems(statusFilter?: string) {
  if (!isSupabaseClient(supabase)) return [];

  const pageSize = 1000;
  const all: StockItem[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("stock_items")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;
    if (error) throw error;

    const batch = (data as unknown as StockItem[]) || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }

  return all;
}

// Load just one folder's sarees, on demand. Keeps big folders fast regardless
// of how many total sarees exist.
export async function getStockItemsByCategory(category: string): Promise<StockItem[]> {
  if (!isSupabaseClient(supabase) || !category) return [];
  const pageSize = 1000;
  const all: StockItem[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("stock_items")
      .select(LIST_COLUMNS)
      .eq("category", category)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data as unknown as StockItem[]) || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return all;
}
