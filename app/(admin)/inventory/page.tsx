"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { StockItem } from "@/types/stock-item";
import { getStockItems } from "@/lib/supabase/stock-items";
import { getCollections } from "@/lib/supabase/collections";
import { useWhatsappShare } from "@/lib/use-share";
import { compressImage } from "@/lib/image";
import { QrScanner } from "@/components/admin/qr-scanner";

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "in_stock" | "sold">("in_stock");
  const [search, setSearch] = useState("");

  // Add-stock form fields
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("");
  const [pattern, setPattern] = useState("");
  const [fabric, setFabric] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [folderNames, setFolderNames] = useState<string[]>([]);

  // WhatsApp share
  const [shareMode, setShareMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { prefetch, isReady, share: shareToWhatsapp, sharing } = useWhatsappShare();

  // Bulk delete (multi-select)
  const [selectMode, setSelectMode] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const statusFilter = filter === "all" ? undefined : filter;
      const data = await getStockItems(statusFilter);
      setItems(data);
    } catch (error) {
      console.error("Error fetching items:", error);
      toast({ title: "Error", description: "Failed to load inventory", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    getCollections()
      .then((cols) => setFolderNames(cols.map((c) => c.name)))
      .catch(() => setFolderNames([]));
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles((prev) => [...prev, ...acceptedFiles]);
    setPreviewUrls((prev) => [...prev, ...acceptedFiles.map((f) => URL.createObjectURL(f))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp"] },
    maxSize: 10 * 1024 * 1024,
    multiple: true,
  });

  const removePreview = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setSelectedFiles([]);
    setPreviewUrls([]);
    setCode("");
    setLabel("");
    setColor("");
    setPattern("");
    setFabric("");
    setCategory("");
    setPrice("");
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No photos", description: "Add at least one photo.", variant: "destructive" });
      return;
    }
    if (code.trim() && selectedFiles.length > 1) {
      toast({
        title: "One code = one saree",
        description: "When you scan/enter a QR code, attach exactly one photo.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      const compressed = await Promise.all(selectedFiles.map((f) => compressImage(f)));
      compressed.forEach((file) => formData.append("files", file));
      if (code.trim()) formData.append("code", code.trim());
      if (label.trim()) formData.append("label", label.trim());
      if (color.trim()) formData.append("color", color.trim());
      if (pattern.trim()) formData.append("pattern", pattern.trim());
      if (fabric.trim()) formData.append("fabric", fabric.trim());
      if (category.trim()) formData.append("category", category.trim());
      if (price.trim()) formData.append("price", price.trim());

      const response = await fetch("/api/inventory", { method: "POST", body: formData });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Upload failed");

      toast({
        title: "Stock added",
        description: `${data.added} saree(s) added.${data.errors ? ` (${data.errors.length} warning(s))` : ""}`,
      });

      resetForm();
      fetchItems();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Upload failed",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: StockItem) => {
    if (!item.id) return;
    if (!confirm(`Delete ${item.code || "this saree"}? This cannot be undone. (To record a sale, use Sell instead.)`)) return;
    setDeleting(item.id);
    try {
      const response = await fetch("/api/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, imageUrl: item.image }),
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast({ title: "Deleted", description: "Item removed." });
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      toast({ title: "Error", description: "Failed to delete.", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    const chosen = items.filter((i) => i.id && selected.has(i.id));
    if (chosen.length === 0) {
      toast({ title: "Nothing selected", description: "Tap sarees to select, then delete." });
      return;
    }
    if (!confirm(`Delete ${chosen.length} saree(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const results = await Promise.allSettled(
        chosen.map((item) =>
          fetch("/api/inventory", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: item.id, imageUrl: item.image }),
          }).then((r) => {
            if (!r.ok) throw new Error("delete failed");
            return item.id as string;
          })
        )
      );
      const okIds = new Set(
        results.filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled").map((r) => r.value)
      );
      const failCount = results.length - okIds.size;
      setItems((prev) => prev.filter((i) => !(i.id && okIds.has(i.id))));
      setSelected(new Set());
      if (failCount > 0) {
        toast({
          title: "Partly done",
          description: `Deleted ${okIds.size}, ${failCount} failed.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Deleted", description: `${okIds.size} item(s) removed.` });
        setSelectMode(false);
      }
    } finally {
      setBulkDeleting(false);
    }
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

  const shareSelected = async () => {
    const chosen = items.filter((i) => i.id && selected.has(i.id));
    if (chosen.length === 0) {
      toast({ title: "Nothing selected", description: "Tap sarees to select, then share." });
      return;
    }
    const result = await shareToWhatsapp(chosen);
    if (result === "text") {
      toast({
        title: "Opened WhatsApp with details",
        description: "To attach the actual photos, open this on a phone or tablet.",
      });
    }
  };

  const existingCollections = useMemo(
    () =>
      Array.from(
        new Set([
          ...folderNames,
          ...(items.map((i) => i.category?.trim()).filter(Boolean) as string[]),
        ])
      ),
    [items, folderNames]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.code, i.label, i.color, i.pattern, i.fabric, i.category]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="mt-1 text-gray-500">
          Register each saree with its QR code. Internal stock only — not published to the website.
        </p>
      </div>

      {/* Add stock */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Add New Stock</h2>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="code">QR Code</Label>
            <div className="mt-1 flex gap-2">
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VS-000001" />
              <Button type="button" variant="outline" onClick={() => setScanning(true)}>
                Scan
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="category">Collection / Folder</Label>
            <Input
              id="category"
              className="mt-1"
              list="collections-list"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Temple, BYR buttas"
            />
            <datalist id="collections-list">
              {existingCollections.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="label">Label / Batch</Label>
            <Input id="label" className="mt-1" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., July Batch" />
          </div>
          <div>
            <Label htmlFor="price">Price (₹)</Label>
            <Input id="price" className="mt-1" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g., 2500" />
          </div>
          <div>
            <Label htmlFor="color">Color</Label>
            <Input id="color" className="mt-1" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g., Red" />
          </div>
          <div>
            <Label htmlFor="pattern">Pattern</Label>
            <Input id="pattern" className="mt-1" value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="e.g., Floral" />
          </div>
          <div>
            <Label htmlFor="fabric">Fabric</Label>
            <Input id="fabric" className="mt-1" value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="e.g., Silk" />
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <p className="font-medium">{isDragActive ? "Drop photos here" : "Take / choose saree photo(s)"}</p>
            <p className="text-sm text-gray-500">
              With a QR code: one photo = one saree. Without a code: add many at once.
            </p>
          </div>
        </div>

        {previewUrls.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">{previewUrls.length} photo(s) selected</p>
              <Button variant="outline" size="sm" onClick={() => { setSelectedFiles([]); setPreviewUrls([]); }}>Clear</Button>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {previewUrls.map((url, index) => (
                <div key={index} className="group relative aspect-square">
                  <div className="relative h-full w-full overflow-hidden rounded-md border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Preview ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                  <button type="button" onClick={() => removePreview(index)} className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleUpload} disabled={uploading} size="lg">
                {uploading ? "Uploading & Analyzing…" : `Add ${selectedFiles.length} Saree(s) to Stock`}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Browse */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Stock ({filtered.length})</h2>
            <div className="flex flex-wrap gap-2">
              {(["in_stock", "sold", "all"] as const).map((f) => (
                <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
                  {f === "in_stock" ? "In Stock" : f === "sold" ? "Sold" : "All"}
                </Button>
              ))}
              <Button
                variant={shareMode ? "default" : "outline"}
                size="sm"
                onClick={() => { setShareMode((s) => !s); setSelectMode(false); setSelected(new Set()); }}
              >
                {shareMode ? "Cancel share" : "Share to WhatsApp"}
              </Button>
              <Button
                variant={selectMode ? "default" : "outline"}
                size="sm"
                className={selectMode ? "bg-red-600 text-white hover:bg-red-700" : ""}
                onClick={() => { setSelectMode((s) => !s); setShareMode(false); setSelected(new Set()); }}
              >
                {selectMode ? "Cancel" : "Select to delete"}
              </Button>
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by code, color, pattern, fabric, label…"
            className="max-w-md"
          />
          {shareMode && (() => {
            const chosen = items.filter((i) => i.id && selected.has(i.id));
            const ready = isReady(chosen);
            return (
              <div className="flex items-center gap-3 rounded-md bg-green-50 p-3">
                <span className="text-sm text-green-800">{selected.size} selected</span>
                <Button size="sm" onClick={shareSelected} disabled={sharing || selected.size === 0 || !ready}>
                  {sharing ? "Opening…" : selected.size > 0 && !ready ? "Preparing photos…" : "Share selected"}
                </Button>
              </div>
            );
          })()}
          {selectMode && (
            <div className="flex flex-wrap items-center gap-3 rounded-md bg-red-50 p-3">
              <span className="text-sm text-red-800">{selected.size} selected</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(new Set(filtered.map((i) => i.id).filter(Boolean) as string[]))}
              >
                Select all ({filtered.length})
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                Clear
              </Button>
              <Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={handleBulkDelete}
                disabled={bulkDeleting || selected.size === 0}
              >
                {bulkDeleting ? "Deleting…" : `Delete selected (${selected.size})`}
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <p className="py-12 text-center text-gray-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-gray-500">
            {filter === "in_stock" ? "No sarees in stock. Add some above." : filter === "sold" ? "No sold sarees yet." : "No items found."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((item) => {
              const isSelected = item.id ? selected.has(item.id) : false;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (shareMode) {
                      prefetch(item);
                      toggleSelect(item.id);
                    } else if (selectMode) {
                      toggleSelect(item.id);
                    }
                  }}
                  className={`group relative overflow-hidden rounded-lg border transition ${
                    item.status === "sold" ? "border-gray-300 opacity-60" : "border-gray-200"
                  } ${shareMode || selectMode ? "cursor-pointer" : ""} ${
                    isSelected ? (selectMode ? "ring-2 ring-red-500" : "ring-2 ring-green-500") : ""
                  }`}
                >
                  <div className="relative aspect-square">
                    <Image src={item.image} alt={item.label || "Saree"} fill className="object-cover" sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw" unoptimized />
                    {item.status === "sold" && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">SOLD</span>
                      </div>
                    )}
                    {(shareMode || selectMode) && isSelected && (
                      <div className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-white ${selectMode ? "bg-red-500" : "bg-green-500"}`}>✓</div>
                    )}
                  </div>
                  <div className="p-2">
                    {item.code && <p className="font-mono text-[11px] font-semibold text-primary">{item.code}</p>}
                    {item.label && <p className="truncate text-xs font-medium">{item.label}</p>}
                    <p className="truncate text-[11px] text-gray-500">
                      {[item.color, item.pattern, item.fabric].filter(Boolean).join(" · ")}
                    </p>
                    {item.price != null && <p className="text-[11px] font-medium">₹{item.price}</p>}
                  </div>
                  {!shareMode && !selectMode && (
                    <button
                      type="button"
                      aria-label="Delete saree"
                      onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                      disabled={deleting === item.id}
                      className="absolute right-1 top-1 rounded-full bg-red-500 p-1.5 text-white shadow-md disabled:opacity-50"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {scanning && (
        <QrScanner onScan={(c) => { setCode(c.trim()); setScanning(false); toast({ title: "Code scanned", description: c }); }} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
