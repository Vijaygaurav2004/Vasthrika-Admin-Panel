"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import { StockItem } from "@/types/stock-item";
import { getStockItems } from "@/lib/supabase/stock-items";
import { useWhatsappShare } from "@/lib/use-share";
import {
  Collection,
  getCollections,
  ensureCollections,
  createCollection,
  renameCollection,
  deleteCollection,
  swapCollectionOrder,
  moveItemsToCollection,
} from "@/lib/supabase/collections";

interface Folder {
  id: string;
  name: string;
  sort_order: number;
  cover?: string;
  count: number;
  items: StockItem[];
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const [manage, setManage] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  // Share-to-WhatsApp (inside a folder)
  const [shareMode, setShareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { prefetch, isReady, share: shareToWhatsapp, sharing } = useWhatsappShare();

  // Move-to-folder (inside a folder)
  const [moveMode, setMoveMode] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [moving, setMoving] = useState(false);

  // Filters inside an open folder
  const [folderStatus, setFolderStatus] = useState<"all" | "in_stock" | "sold">("all");
  const [folderSearch, setFolderSearch] = useState("");

  const closeFolder = () => {
    setOpenFolder(null);
    setShareMode(false);
    setMoveMode(false);
    setMoveTarget("");
    setSelected(new Set());
    setFolderStatus("all");
    setFolderSearch("");
  };

  const toggleSelect = (id?: string) => {
    if (!id) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const shareSelected = async (folderItems: StockItem[]) => {
    const chosen = folderItems.filter((i) => i.id && selected.has(i.id));
    if (chosen.length === 0) {
      toast({ title: "Nothing selected", description: "Tap sarees to select, then share." });
      return;
    }
    const { result, shared } = await shareToWhatsapp(chosen);
    if (shared.length > 0) {
      const sharedIds = new Set(shared.map((i) => i.id));
      setSelected((prev) => {
        const next = new Set(prev);
        sharedIds.forEach((id) => id && next.delete(id));
        return next;
      });
      const left = chosen.length - shared.length;
      if (left > 0) {
        toast({
          title: `Shared ${shared.length} (max per WhatsApp)`,
          description: `${left} still selected — tap "Share selected" again to send the next batch.`,
        });
      }
    }
    if (result === "text") {
      toast({
        title: "Opened WhatsApp with details",
        description: "To attach the actual photos, open this on a phone or tablet.",
      });
    }
  };

  const handleMove = async (folderItems: StockItem[]) => {
    const ids = folderItems.filter((i) => i.id && selected.has(i.id)).map((i) => i.id as string);
    if (ids.length === 0 || !moveTarget) return;
    setMoving(true);
    try {
      await moveItemsToCollection(ids, moveTarget);
      toast({ title: "Moved", description: `${ids.length} saree(s) moved to "${moveTarget}".` });
      setSelected(new Set());
      setMoveMode(false);
      setMoveTarget("");
      await load();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to move",
        variant: "destructive",
      });
    } finally {
      setMoving(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [cols, its] = await Promise.all([getCollections(), getStockItems()]);
      // Auto-add any folder that exists on stock but isn't in the table yet.
      const itemCats = its.map((i) => i.category).filter(Boolean) as string[];
      const known = new Set(cols.map((c) => c.name));
      if (itemCats.some((c) => !known.has(c))) {
        await ensureCollections(itemCats);
        setCollections(await getCollections());
      } else {
        setCollections(cols);
      }
      setItems(its);
    } catch (e) {
      console.error(e);
      toast({
        title: "Couldn't load folders",
        description: "If the database setup SQL hasn't been run yet, run it first.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const folders: Folder[] = useMemo(() => {
    return collections.map((c) => {
      const its = items.filter((i) => (i.category?.trim() || "") === c.name);
      const inStockCover = its.find((i) => i.status === "in_stock")?.image;
      return {
        id: c.id,
        name: c.name,
        sort_order: c.sort_order,
        cover: inStockCover || its[0]?.image,
        count: its.filter((i) => i.status === "in_stock").length,
        items: its,
      };
    });
  }, [collections, items]);

  const visibleFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, search]);

  const current = openFolder ? folders.find((f) => f.name === openFolder) : null;

  // ---- Actions ----
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createCollection(newName);
      setNewName("");
      toast({ title: "Folder created", description: newName.trim() });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (f: Folder) => {
    const next = window.prompt("Rename folder:", f.name);
    if (next == null || next.trim() === "" || next.trim() === f.name) return;
    setBusy(true);
    try {
      await renameCollection(f.id, f.name, next);
      toast({ title: "Renamed", description: `${f.name} → ${next.trim()}` });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (f: Folder) => {
    const msg =
      f.items.length > 0
        ? `Delete folder "${f.name}"? Its ${f.items.length} saree(s) will stay in stock but become un-foldered.`
        : `Delete empty folder "${f.name}"?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await deleteCollection(f.id, f.name);
      toast({ title: "Folder deleted", description: f.name });
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= folders.length) return;
    setBusy(true);
    try {
      const a = folders[index];
      const b = folders[target];
      await swapCollectionOrder(a, b);
      await load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Failed", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // ---- Drill-down: one folder's sarees ----
  if (current) {
    const q = folderSearch.trim().toLowerCase();
    const folderFiltered = current.items.filter((i) => {
      if (folderStatus !== "all" && i.status !== folderStatus) return false;
      if (!q) return true;
      return [i.code, i.label, i.color, i.pattern, i.fabric]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={closeFolder}>
            ← All folders
          </Button>
          <h1 className="text-xl font-bold">{current.name}</h1>
          <span className="text-sm text-gray-500">({folderFiltered.length})</span>
          {current.items.length > 0 && (
            <div className="ml-auto flex gap-2">
              <Button
                variant={shareMode ? "default" : "outline"}
                size="sm"
                onClick={() => { setShareMode((s) => !s); setMoveMode(false); setSelected(new Set()); }}
              >
                {shareMode ? "Cancel" : "Share to WhatsApp"}
              </Button>
              <Button
                variant={moveMode ? "default" : "outline"}
                size="sm"
                onClick={() => { setMoveMode((m) => !m); setShareMode(false); setSelected(new Set()); setMoveTarget(""); }}
              >
                {moveMode ? "Cancel" : "Move to folder"}
              </Button>
            </div>
          )}
        </div>

        {current.items.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {(["in_stock", "sold", "all"] as const).map((f) => (
                <Button
                  key={f}
                  variant={folderStatus === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFolderStatus(f)}
                >
                  {f === "in_stock" ? "In Stock" : f === "sold" ? "Sold" : "All"}
                </Button>
              ))}
            </div>
            <Input
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              placeholder="Search by code, color, pattern, fabric, label…"
              className="max-w-md"
            />
          </div>
        )}

        {shareMode && (() => {
          const chosen = current.items.filter((i) => i.id && selected.has(i.id));
          const ready = isReady(chosen);
          return (
            <div className="flex items-center gap-3 rounded-md bg-green-50 p-3">
              <span className="text-sm text-green-800">{selected.size} selected</span>
              <Button size="sm" onClick={() => shareSelected(current.items)} disabled={sharing || selected.size === 0 || !ready}>
                {sharing ? "Opening…" : selected.size > 0 && !ready ? "Preparing photos…" : "Share selected"}
              </Button>
            </div>
          );
        })()}

        {moveMode && (
          <div className="flex flex-wrap items-center gap-3 rounded-md bg-blue-50 p-3">
            <span className="text-sm text-blue-800">{selected.size} selected</span>
            <select
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">Move to folder…</option>
              {collections
                .filter((c) => c.name !== current.name)
                .map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
            </select>
            <Button size="sm" onClick={() => handleMove(current.items)} disabled={moving || selected.size === 0 || !moveTarget}>
              {moving ? "Moving…" : "Move here"}
            </Button>
          </div>
        )}

        {current.items.length === 0 ? (
          <p className="rounded-lg border bg-white p-8 text-center text-gray-500 shadow-sm">
            This folder is empty. Add sarees to it from the Inventory screen.
          </p>
        ) : folderFiltered.length === 0 ? (
          <p className="rounded-lg border bg-white p-8 text-center text-gray-500 shadow-sm">
            No sarees match these filters.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 rounded-lg border bg-white p-4 shadow-sm sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {folderFiltered.map((item) => {
              const isSelected = item.id ? selected.has(item.id) : false;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (shareMode) {
                      prefetch(item);
                      toggleSelect(item.id);
                    } else if (moveMode) {
                      toggleSelect(item.id);
                    }
                  }}
                  className={`overflow-hidden rounded-lg border transition ${item.status === "sold" ? "opacity-60" : ""} ${shareMode || moveMode ? "cursor-pointer" : ""} ${isSelected ? (moveMode ? "ring-2 ring-blue-500" : "ring-2 ring-green-500") : ""}`}
                >
                  <div className="relative aspect-square">
                    <Image src={item.image} alt={item.label || "Saree"} fill className="object-cover" sizes="(min-width:768px) 20vw, 50vw" unoptimized />
                    {item.status === "sold" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">SOLD</span>
                      </div>
                    )}
                    {(shareMode || moveMode) && isSelected && (
                      <div className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-white ${moveMode ? "bg-blue-500" : "bg-green-500"}`}>✓</div>
                    )}
                  </div>
                  <div className="p-2">
                    {item.code && <p className="font-mono text-[11px] font-semibold text-primary">{item.code}</p>}
                    <p className="truncate text-[11px] text-gray-500">
                      {[item.color, item.pattern, item.fabric].filter(Boolean).join(" · ")}
                    </p>
                    {item.price != null && <p className="text-[11px] font-medium">₹{item.price}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---- Manage mode: list with rename / reorder / delete ----
  if (manage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Manage Folders</h1>
            <p className="mt-1 text-sm text-gray-500">Rename, reorder, or delete. Deleting never deletes sarees.</p>
          </div>
          <Button variant="outline" onClick={() => setManage(false)}>Done</Button>
        </div>

        <div className="flex gap-2 rounded-lg border bg-white p-4 shadow-sm">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New folder name" onKeyDown={(e) => e.key === "Enter" && handleCreate()} />
          <Button onClick={handleCreate} disabled={busy || !newName.trim()}>Add folder</Button>
        </div>

        <div className="divide-y rounded-lg border bg-white shadow-sm">
          {folders.map((f, i) => (
            <div key={f.id} className="flex items-center gap-3 p-3">
              <div className="flex flex-col">
                <button className="px-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" onClick={() => move(i, -1)} disabled={busy || i === 0}>▲</button>
                <button className="px-1 text-gray-500 hover:text-gray-900 disabled:opacity-30" onClick={() => move(i, 1)} disabled={busy || i === folders.length - 1}>▼</button>
              </div>
              <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded border bg-gray-100">
                {f.cover && <Image src={f.cover} alt="" fill className="object-cover" sizes="40px" unoptimized />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-gray-400">{f.count} in stock</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleRename(f)} disabled={busy}>Rename</Button>
              <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(f)} disabled={busy}>Delete</Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Folder grid (like Apple Photos albums) ----
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Collections</h1>
          <p className="mt-1 text-gray-500">Your saree folders. Tap one to see what&apos;s inside.</p>
        </div>
        <Button variant="outline" onClick={() => setManage(true)}>Manage folders</Button>
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search folders…" className="max-w-xs" />

      {loading ? (
        <p className="py-12 text-center text-gray-400">Loading…</p>
      ) : visibleFolders.length === 0 ? (
        <p className="py-12 text-center text-gray-500">No folders found.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500">{visibleFolders.length} folders</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleFolders.map((folder) => (
              <button key={folder.id} onClick={() => setOpenFolder(folder.name)} className="group text-left">
                <div className="relative aspect-square overflow-hidden rounded-xl border bg-gray-100 shadow-sm transition group-hover:shadow-md">
                  {folder.cover ? (
                    <Image src={folder.cover} alt={folder.name} fill className="object-cover" sizes="(min-width:768px) 20vw, 50vw" unoptimized />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-300">Empty</div>
                  )}
                </div>
                <p className="mt-1.5 truncate text-sm font-medium">{folder.name}</p>
                <p className="text-xs text-gray-400">{folder.count}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
