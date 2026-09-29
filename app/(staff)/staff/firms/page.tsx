"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { getFirmPurchases } from "@/lib/supabase/stock-items";
import { StockItem } from "@/types/stock-item";
import { useIsAdmin } from "@/lib/use-role";
import { Input } from "@/components/ui/input";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

interface Firm {
  name: string;
  items: StockItem[];
  folders: [string, number][]; // most-bought folders (his design families)
  colors: [string, number][]; // most-bought colours
  lastAt: number;
  spend: number;
}

// Count occurrences and return sorted [value, count] pairs (top first).
function topCounts(items: StockItem[], pick: (i: StockItem) => string | undefined): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) {
    const v = (pick(it) || "").trim();
    if (!v) continue;
    m.set(v, (m.get(v) || 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

export default function FirmsPage() {
  const isAdmin = useIsAdmin();
  const [rows, setRows] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    getFirmPurchases()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const firms = useMemo<Firm[]>(() => {
    const groups = new Map<string, { display: string; items: StockItem[] }>();
    for (const it of rows) {
      const raw = (it.firm_name || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const g = groups.get(key) || { display: raw, items: [] };
      g.items.push(it);
      groups.set(key, g);
    }
    const out: Firm[] = [];
    for (const { display, items } of groups.values()) {
      out.push({
        name: display,
        items,
        folders: topCounts(items, (i) => i.category).slice(0, 3),
        colors: topCounts(items, (i) => i.color).slice(0, 3),
        lastAt: Math.max(...items.map((i) => (i.sold_at ? new Date(i.sold_at).getTime() : 0))),
        spend: items.reduce((s, i) => s + (i.price ? Number(i.price) : 0), 0),
      });
    }
    return out.sort((a, b) => b.items.length - a.items.length);
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? firms.filter((f) => f.name.toLowerCase().includes(q)) : firms;
  }, [firms, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Firms</h1>
        <p className="mt-1 text-gray-500">
          Each client firm and the styles they buy. When a client walks in, search their firm to see what suits their taste.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search a firm name…"
        className="max-w-md"
      />

      {loading ? (
        <p className="py-12 text-center text-gray-400">Loading firms…</p>
      ) : firms.length === 0 ? (
        <div className="rounded-lg border bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-gray-700">No firm history yet.</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            As staff mark sarees sold with a firm name on the Sell screen, each firm and its style history will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-gray-400">No firm matches “{search}”.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((f) => {
            const expanded = open === f.name;
            return (
              <div key={f.name} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                <button
                  onClick={() => setOpen(expanded ? null : f.name)}
                  className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold">{f.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {f.items.length} saree{f.items.length === 1 ? "" : "s"} bought
                      {f.lastAt ? ` · last ${format(new Date(f.lastAt), "d MMM yyyy")}` : ""}
                      {isAdmin && f.spend > 0 ? ` · ${inr(f.spend)}` : ""}
                    </p>
                    {/* Style at a glance — his design families & colours */}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.folders.map(([name, n]) => (
                        <span key={"f" + name} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] text-indigo-700">
                          {name} ×{n}
                        </span>
                      ))}
                      {f.colors.map(([name, n]) => (
                        <span key={"c" + name} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                          {name} ×{n}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <div className="flex -space-x-2">
                      {f.items.slice(0, 4).map((it) => (
                        <div key={it.id} className="h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-gray-100">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={it.image} alt="" className="h-full w-full object-cover" />
                        </div>
                      ))}
                    </div>
                    <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                      {f.items.map((it) => (
                        <div key={it.id} className="overflow-hidden rounded-md border bg-white">
                          <div className="relative aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={it.image} alt={it.code || ""} className="h-full w-full object-cover" />
                          </div>
                          <div className="p-1 text-center">
                            <p className="truncate font-mono text-[10px] font-semibold">{it.code || "—"}</p>
                            {it.category ? <p className="truncate text-[9px] text-gray-500">{it.category}</p> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
