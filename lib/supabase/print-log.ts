import { supabase, isSupabaseClient } from "./client";

export interface QrPrintBatch {
  id?: string;
  prefix: string;
  from_number: number;
  to_number: number;
  count: number;
  printed_by?: string | null;
  printed_at?: string;
}

// Record a print batch. Safe before the table migration runs (error ignored).
export async function logQrPrint(
  batch: Omit<QrPrintBatch, "id" | "printed_at">
): Promise<void> {
  if (!isSupabaseClient(supabase)) return;
  await supabase.from("qr_print_log").insert({
    prefix: batch.prefix,
    from_number: batch.from_number,
    to_number: batch.to_number,
    count: batch.count,
    printed_by: batch.printed_by || null,
  });
}

export async function getQrPrintHistory(limit = 100): Promise<QrPrintBatch[]> {
  if (!isSupabaseClient(supabase)) return [];
  const { data, error } = await supabase
    .from("qr_print_log")
    .select("*")
    .order("printed_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data as QrPrintBatch[]) || [];
}
