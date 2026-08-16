import { supabase } from "./client";

export interface Collection {
  id: string;
  name: string;
  sort_order: number;
  created_at?: string;
}

export async function getCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Collection[];
}

export async function createCollection(name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name required");
  const existing = await getCollections();
  const nextOrder = existing.length ? Math.max(...existing.map((c) => c.sort_order)) + 1 : 1;
  const { error } = await supabase.from("collections").insert({ name: trimmed, sort_order: nextOrder });
  if (error) throw error;
}

/** Insert any folder names that exist on stock but aren't yet in the table. */
export async function ensureCollections(names: string[]): Promise<void> {
  const clean = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  if (clean.length === 0) return;
  const existing = await getCollections();
  const have = new Set(existing.map((c) => c.name));
  const missing = clean.filter((n) => !have.has(n));
  if (missing.length === 0) return;
  let order = existing.length ? Math.max(...existing.map((c) => c.sort_order)) : 0;
  const rows = missing.map((name) => ({ name, sort_order: ++order }));
  const { error } = await supabase.from("collections").insert(rows);
  if (error) throw error;
}

export async function renameCollection(id: string, oldName: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("Folder name required");
  const { error } = await supabase.from("collections").update({ name: trimmed }).eq("id", id);
  if (error) throw error;
  // Re-tag every saree that was in the old folder.
  await supabase.from("stock_items").update({ category: trimmed }).eq("category", oldName);
}

/** Move sarees (by id) into a different folder/collection. */
export async function moveItemsToCollection(ids: string[], target: string): Promise<void> {
  const name = target.trim();
  if (!name || ids.length === 0) return;
  const { error } = await supabase
    .from("stock_items")
    .update({ category: name, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function deleteCollection(id: string, name: string): Promise<void> {
  // Move any sarees in this folder to "no folder" (they are NOT deleted).
  await supabase.from("stock_items").update({ category: null }).eq("category", name);
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}

/** Swap the sort_order of two folders. */
export async function swapCollectionOrder(
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number }
): Promise<void> {
  await supabase.from("collections").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("collections").update({ sort_order: a.sort_order }).eq("id", b.id);
}
