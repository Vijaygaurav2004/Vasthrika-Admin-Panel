"use client";

import { useState, useEffect, useCallback } from "react";
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
  file: File;
  url: string;
}

const pad = (n: number) => String(n).padStart(6, "0");

export default function BulkAddPage() {
  const actor = useActor();
  const [folder, setFolder] = useState("");
  const [folderNames, setFolderNames] = useState<string[]>([]);
  const [prefix, setPrefix] = useState("");
  const [startNumber, setStartNumber] = useState(1);
  const [pics, setPics] = useState<Pic[]>([]);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getCollections()
      .then((c) => setFolderNames(c.map((x) => x.name)))
      .catch(() => setFolderNames([]));
  }, []);

  // When the folder changes, suggest its prefix (from the codes already in it).
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

  // When the prefix changes, continue from the highest existing number for it.
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
    setPics((prev) => [...prev, ...accepted.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpeg", ".jpg", ".png", ".webp", ".heic"] },
    multiple: true,
  });

  const move = (i: number, dir: -1 | 1) => {
    setPics((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };
  const remove = (i: number) => setPics((prev) => prev.filter((_, x) => x !== i));

  const codeFor = (i: number) => `${prefix.trim().toUpperCase()}-${pad(startNumber + i)}`;

  const saveAll = async () => {
    if (!folder.trim()) return toast({ title: "Pick a folder first", variant: "destructive" });
    if (!prefix.trim()) return toast({ title: "Enter a code prefix", variant: "destructive" });
    if (pics.length === 0) return toast({ title: "Add some photos", variant: "destructive" });

    setSaving(true);
    setProgress(0);
    let ok = 0;
    const errors: string[] = [];
    for (let i = 0; i < pics.length; i++) {
      const code = codeFor(i);
      try {
        const compressed = await compressImage(pics[i].file);
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
      setPics([]);
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

  const lastCode = pics.length > 0 ? codeFor(pics.length - 1) : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bulk Add</h1>
        <p className="mt-1 text-gray-500">
          Add many saris at once. Each gets a unique code, in order, continuing from the folder&apos;s last code.
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
            <Label>Codes will be</Label>
            <p className="mt-2 font-mono text-sm">
              {prefix.trim() && pics.length > 0 ? (
                <>
                  {codeFor(0)} <span className="text-gray-400">→</span> {lastCode}
                </>
              ) : prefix.trim() ? (
                <>starts at {codeFor(0)}</>
              ) : (
                <span className="text-gray-400">pick a folder</span>
              )}
            </p>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`mt-5 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"}`}
        >
          <input {...getInputProps()} />
          <p className="font-medium">Take / choose saree photos</p>
          <p className="text-sm text-gray-500">Add all the saris for this folder — you&apos;ll set the order below.</p>
        </div>
      </div>

      {pics.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{pics.length} saree(s) — set the order</h2>
            <Button variant="outline" size="sm" onClick={() => setPics([])} disabled={saving}>Clear</Button>
          </div>
          <p className="mb-4 text-sm text-gray-500">
            Use ◀ ▶ to arrange so the order matches how you&apos;ll stick the stickers. Each photo shows its assigned code.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {pics.map((p, i) => (
              <div key={i} className="overflow-hidden rounded-lg border">
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-bold text-white">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={saving}
                    className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white shadow"
                    aria-label="Remove"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="p-2">
                  <p className="text-center font-mono text-[11px] font-semibold text-primary">{codeFor(i)}</p>
                  <div className="mt-1 flex justify-center gap-2">
                    <button type="button" onClick={() => move(i, -1)} disabled={saving || i === 0} className="rounded border px-2 text-sm disabled:opacity-30">◀</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={saving || i === pics.length - 1} className="rounded border px-2 text-sm disabled:opacity-30">▶</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-4">
            <Button size="lg" onClick={saveAll} disabled={saving}>
              {saving ? `Saving ${progress}/${pics.length}…` : `Save ${pics.length} saree(s)`}
            </Button>
            {saving && <span className="text-sm text-gray-500">Please keep this screen open…</span>}
          </div>
        </div>
      )}
    </div>
  );
}
