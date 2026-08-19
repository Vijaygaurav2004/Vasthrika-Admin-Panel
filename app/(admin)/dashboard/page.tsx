// app/(admin)/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getStockItems } from "@/lib/supabase/stock-items";
import { StockItem } from "@/types/stock-item";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default function DashboardPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStockItems()
      .then((d) => setItems(d))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let inStock = 0, sold = 0, soldToday = 0, soldMonth = 0, addedToday = 0, addedMonth = 0;
    let stockValue = 0, soldValueMonth = 0;
    const folders = new Set<string>();
    for (const it of items) {
      if (it.category) folders.add(it.category);
      const created = it.created_at ? new Date(it.created_at).getTime() : 0;
      if (created >= startToday) addedToday++;
      if (created >= startMonth) addedMonth++;
      if (it.status === "sold") {
        sold++;
        const s = it.sold_at ? new Date(it.sold_at).getTime() : 0;
        if (s >= startToday) soldToday++;
        if (s >= startMonth) { soldMonth++; if (it.price) soldValueMonth += Number(it.price); }
      } else {
        inStock++;
        if (it.price) stockValue += Number(it.price);
      }
    }
    return { total: items.length, inStock, sold, soldToday, soldMonth, addedToday, addedMonth, stockValue, soldValueMonth, folders: folders.size };
  }, [items]);

  const daily = useMemo(() => {
    const now = new Date();
    const days: { label: string; added: number; sold: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      let added = 0, sold = 0;
      for (const it of items) {
        const c = it.created_at ? new Date(it.created_at).getTime() : 0;
        if (c >= start && c < end) added++;
        if (it.status === "sold" && it.sold_at) {
          const s = new Date(it.sold_at).getTime();
          if (s >= start && s < end) sold++;
        }
      }
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, added, sold });
    }
    return days;
  }, [items]);

  const activity = useMemo(() => {
    const events: { type: "added" | "sold"; at: number; item: StockItem }[] = [];
    for (const it of items) {
      if (it.created_at) events.push({ type: "added", at: new Date(it.created_at).getTime(), item: it });
      if (it.status === "sold" && it.sold_at) events.push({ type: "sold", at: new Date(it.sold_at).getTime(), item: it });
    }
    events.sort((a, b) => b.at - a.at);
    return events.slice(0, 25);
  }, [items]);

  const maxBar = Math.max(1, ...daily.map((d) => Math.max(d.added, d.sold)));

  if (loading) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
        <p className="py-12 text-center text-gray-400">Loading activity…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="In Stock" value={stats.inStock} accent="text-green-600" href="/inventory" />
        <Stat label="Sold (total)" value={stats.sold} accent="text-gray-700" href="/inventory" />
        <Stat label="Sold this month" value={stats.soldMonth} sub={stats.soldToday ? `${stats.soldToday} today` : undefined} accent="text-blue-600" />
        <Stat label="Added this month" value={stats.addedMonth} sub={stats.addedToday ? `${stats.addedToday} today` : undefined} accent="text-indigo-600" />
        <Stat label="Stock value" value={inr(stats.stockValue)} accent="text-emerald-600" />
        <Stat label="Folders" value={stats.folders} accent="text-gray-700" href="/collections" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 14-day activity chart */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Last 14 days</h2>
            <div className="flex gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-indigo-500" /> Added</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-500" /> Sold</span>
            </div>
          </div>
          <div className="flex h-40 items-end justify-between gap-1">
            {daily.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  <div className="w-1/2 rounded-t bg-indigo-500" style={{ height: `${(d.added / maxBar) * 100}%` }} title={`${d.added} added`} />
                  <div className="w-1/2 rounded-t bg-green-500" style={{ height: `${(d.sold / maxBar) * 100}%` }} title={`${d.sold} sold`} />
                </div>
                <span className="text-[9px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity feed */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Recent activity</h2>
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No activity yet.</p>
          ) : (
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {activity.map((e, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded border bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={e.item.image} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className={e.type === "sold" ? "font-semibold text-green-700" : "font-semibold text-indigo-700"}>
                        {e.type === "sold" ? "Sold" : "Added"}
                      </span>{" "}
                      <span className="font-mono text-xs">{e.item.code || "—"}</span>
                      {e.item.category ? <span className="text-gray-500"> · {e.item.category}</span> : null}
                      {e.type === "sold" && e.item.price != null ? <span className="text-gray-500"> · {inr(Number(e.item.price))}</span> : null}
                    </p>
                    <p className="text-[11px] text-gray-400">{formatDistanceToNow(new Date(e.at), { addSuffix: true })}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent, href }: { label: string; value: number | string; sub?: string; accent?: string; href?: string }) {
  const body = (
    <div className="rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent || ""}`}>{value}</p>
      {sub ? <p className="text-[11px] text-gray-400">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
