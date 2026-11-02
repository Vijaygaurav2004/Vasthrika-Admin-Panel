import { SupabaseClient } from "@supabase/supabase-js";
import { supabase, isSupabaseClient } from "./client";
import { StockItem } from "@/types/stock-item";
import { roleOf } from "@/lib/role";

// Prices are owner-only. Once supabase/LOCK_DOWN_ACCESS.sql has run, logged-in
// users can't select the `price` column at all — so never select "*" on
// stock_items (it fails); list the columns. The owner gets prices through
// withPrices(), which reads them from the owner-only stock_item_prices().
export const STOCK_ITEM_COLUMNS =
  "id,code,image,label,category,color,pattern,fabric,notes,ai_description,status,sold_at,firm_name,buyer_name,buyer_phone,created_by,sold_by,created_at,updated_at";

// Prices by saree id (only sarees that have one). Before the lock-down SQL is
// run the function doesn't exist yet, so fall back to reading the column.
async function priceMap(db: SupabaseClient, ids?: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const pageSize = 1000;
  let legacy = false;
  const page = (from: number) => {
    const to = from + pageSize - 1;
    if (legacy) {
      let q = db.from("stock_items").select("id,price").not("price", "is", null);
      if (ids) q = q.in("id", ids);
      return q.order("id").range(from, to);
    }
    let q = db.rpc("stock_item_prices");
    if (ids) q = q.in("id", ids);
    return q.order("id").range(from, to);
  };
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from);
    if (error) {
      const missing = error.code === "PGRST202" || error.code === "42883";
      if (missing && !legacy && from === 0) {
        legacy = true;
        from -= pageSize;
        continue;
      }
      return map;
    }
    const rows = (data || []) as { id: string; price: number | string | null }[];
    for (const r of rows) if (r.price != null) map.set(r.id, Number(r.price));
    if (rows.length < pageSize) return map;
  }
}

/** Fill in `price` on sarees. Call only for the owner (staff never get prices). */
export async function withPrices<T extends { id?: string; price?: number }>(
  db: SupabaseClient,
  items: T[]
): Promise<T[]> {
  if (items.length === 0) return items;
  // A few sarees: ask for just those. A whole list: one sweep of all prices.
  const ids = items.length <= 50 ? (items.map((i) => i.id).filter(Boolean) as string[]) : undefined;
  const prices = await priceMap(db, ids);
  if (prices.size === 0) return items;
  return items.map((i) => (i.id && prices.has(i.id) ? { ...i, price: prices.get(i.id) } : i));
}

// Browser lists: prices are added only when the owner is logged in.
async function withOwnerPrices<T extends { id?: string; price?: number }>(items: T[]): Promise<T[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (roleOf(session?.user) !== "owner") return items;
  return withPrices(supabase, items);
}

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

// Distinct firm (client) names already billed — powers the firm-name
// auto-suggest on the Sell screen so staff pick the SAME firm each time
// instead of retyping it (keeps spelling consistent for the style history).
// Resilient: returns [] if the firm_name column isn't there yet.
export async function getFirmNames(): Promise<string[]> {
  if (!isSupabaseClient(supabase)) return [];
  const { data, error } = await supabase
    .from("stock_items")
    .select("firm_name")
    .not("firm_name", "is", null)
    .order("firm_name", { ascending: true })
    .limit(5000);
  if (error || !data) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of data as { firm_name?: string }[]) {
    const name = (r.firm_name || "").trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}

// All sold sarees that have a firm attached — powers the Firms view (each
// client firm → the sarees/styles they've bought). Resilient: returns [] if
// the firm_name column isn't there yet.
export async function getFirmPurchases(): Promise<StockItem[]> {
  if (!isSupabaseClient(supabase)) return [];
  const cols = "id,code,image,category,color,pattern,firm_name,sold_at,sold_by";
  const pageSize = 1000;
  const all: StockItem[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("stock_items")
      .select(cols)
      .eq("status", "sold")
      .not("firm_name", "is", null)
      .order("sold_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return withOwnerPrices(all);
    const batch = (data as unknown as StockItem[]) || [];
    all.push(...batch);
    if (batch.length < pageSize) break;
  }
  return withOwnerPrices(all);
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
  "id,code,image,label,category,color,pattern,fabric,notes,status,sold_at,buyer_name,buyer_phone,created_by,sold_by,created_at,updated_at";

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

  return withOwnerPrices(all);
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
  return withOwnerPrices(all);
}
