"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { getMaxCodeNumber, getFolderCodeInfo } from "@/lib/supabase/stock-items";
import { getCollections } from "@/lib/supabase/collections";
import { useActor } from "@/lib/use-role";
import { compressImage } from "@/lib/image";

interface Pic {
  id: number;
  file: File;
  url: string;
}

const pad = (n: number) => String(n).padStart(6, "0");

export default function BulkAddPage() {
  const actor = useActor();
  const idRef = useRef(0);
  const [folder, setFolder] = useState("");
  const [folderNames, setFolderNames] = useState<string[]>([]);
  const [prefix, setPrefix] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [pics, setPics] = useState<Pic[]>([]);
  const [order, setOrder] = useState<number[]>([]); // pic ids in tap order
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getCollections()
      .then((c) => setFolderNames(c.map((x) => x.name)))
      .catch(() => setFolderNames([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!folder.trim()) return;
      try {
        const info = await getFolderCodeInfo(folder.trim());
        if (!cancelled && info.prefix) setPrefix(info.prefix);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = prefix.trim().toUpperCase();
      if (!p) {
        setStartNumber(1);
        return;
      }
      try {
        const max = await getMaxCodeNumber(p);
        if (!cancelled) setStartNumber(max + 1);
      } catch {
        if (!cancelled) setStartNumber(1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const onDrop = useCallback((accepted: File[]) => {
    setPics((prev) => [
      ...prev,
      ...accepted.map((f) => ({ id: idRef.current++, file: f, url: URL.createObjectURL(f) })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"] },
    multiple: true,
  });

  // Tap a photo: add it to the sequence (next number), or remove it (renumbers the rest).
  const tap = (id: number) => {
    if (saving) return;
    setOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const removePic = (id: number) => {
    setPics((prev) => prev.filter((p) => p.id !== id));
    setOrder((prev) => prev.filter((x) => x !== id));
  };

  const posOf = (id: number) => order.indexOf(id);
  const codeForPos = (pos: number) => `${prefix.trim().toUpperCase()}-${pad(startNumber + pos)}`;

  const saveAll = async () => {
    if (!folder.trim()) return toast({ title: "Pick a folder first", variant: "destructive" });
    if (!prefix.trim()) return toast({ title: "Enter a code prefix", variant: "destructive" });
    const sequenced = order.map((id) => pics.find((p) => p.id === id)).filter(Boolean) as Pic[];
    if (sequenced.length === 0)
      return toast({ title: "Tap the saris in order first", description: "First tap = code 1, next = code 2…" });

    const unassigned = pics.length - order.length;
    if (unassigned > 0 && !window.confirm(`${unassigned} photo(s) aren't numbered yet and won't be saved. Continue?`)) return;

    setSaving(true);
    setProgress(0);
    let ok = 0;
    const errors: string[] = [];
    for (let i = 0; i < sequenced.length; i++) {
      const code = codeForPos(i);
      try {
        const compressed = await compressImage(sequenced[i].file);
        const fd = new FormData();
        fd.append("files", compressed);
        fd.append("code", code);
        fd.append("category", folder.trim());
        if (actor) fd.append("actor", actor);
        const res = await fetch("/api/inventory", { method: "POST", body: fd });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "failed");
        }
        ok++;
      } catch (e) {
        errors.push(`${code}: ${e instanceof Error ? e.message : "failed"}`);
      }
      setProgress(i + 1);
    }
    setSaving(false);

    if (ok > 0) {
      toast({ title: "Saved", description: `${ok} saree(s) added to "${folder.trim()}".` });
      const savedIds = new Set(sequenced.slice(0, ok).map((p) => p.id));
      setPics((prev) => prev.filter((p) => !savedIds.has(p.id)));
      setOrder((prev) => prev.filter((id) => !savedIds.has(id)));
      try {
        const max = await getMaxCodeNumber(prefix.trim().toUpperCase());
        setStartNumber(max + 1);
      } catch {
        /* ignore */
      }
    }
    if (errors.length) {
      toast({ title: `${errors.length} failed`, description: errors.slice(0, 3).join(" · "), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Add</h1>
        <p className="mt-1 text-gray-500">
          Add many saris at once. Tap them one-by-one in order — each gets a unique code continuing from the folder&apos;s last code.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="folder">Folder</Label>
            <Input id="folder" list="bulk-folders" className="mt-1" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="e.g., BYR buttas" />
            <datalist id="bulk-folders">
              {folderNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div>
            <Label htmlFor="prefix">Code prefix</Label>
            <Input id="prefix" className="mt-1" value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="e.g., BYR02" />
          </div>
          <div>
            <Label>Next code</Label>
            <p className="mt-2 font-mono text-sm">
              {prefix.trim() ? codeForPos(0) : <span className="text-gray-400">pick a folder</span>}
            </p>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`mt-5 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
        >
          <input {...getInputProps()} />
          <p className="font-medium">Take / choose saree photos</p>
          <p className="text-sm text-gray-500">Add all the saris for this folder, then tap them in order below.</p>
        </div>
      </div>

      {pics.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              Tap in order — {order.length}/{pics.length} numbered
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOrder([])} disabled={saving || order.length === 0}>
                Reset order
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setPics([]); setOrder([]); }} disabled={saving}>
                Clear all
              </Button>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Tap each saree in the order you&apos;ll stick the stickers: first tap → <span className="font-mono">{codeForPos(0)}</span>, next → <span className="font-mono">{codeForPos(1)}</span>… Tap again to un-number.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pics.map((p) => {
              const pos = posOf(p.id);
              const numbered = pos >= 0;
              return (
                <div
                  key={p.id}
                  onClick={() => tap(p.id)}
                  className={`cursor-pointer overflow-hidden rounded-lg border transition ${numbered ? "ring-2 ring-green-500" : "opacity-80 hover:opacity-100"}`}
                >
                  <div className="relative aspect-square">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt="" className="h-full w-full object-cover" />
                    {numbered ? (
                      <span className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white shadow">
                        {pos + 1}
                      </span>
                    ) : (
                      <span className="absolute left-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">tap</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removePic(p.id); }}
                      disabled={saving}
                      className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow"
                      aria-label="Remove"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="p-2 text-center font-mono text-[11px] font-semibold text-primary">
                    {numbered ? codeForPos(pos) : "—"}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <Button size="lg" onClick={saveAll} disabled={saving || order.length === 0}>
              {saving ? `Saving ${progress}/${order.length}…` : `Save ${order.length} saree(s)`}
            </Button>
            {saving && <span className="text-sm text-gray-500">Please keep this screen open…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
