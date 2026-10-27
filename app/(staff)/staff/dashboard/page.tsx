// app/(staff)/staff/dashboard/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { getStockItems } from "@/lib/supabase/stock-items";
import { StockItem } from "@/types/stock-item";
import { useIsAdmin } from "@/lib/use-role";
import { displayName } from "@/lib/role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ManageStaff } from "@/components/staff/manage-staff";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

type ActType = "all" | "added" | "sold";
type ActRange = "today" | "7d" | "30d" | "all";
const RANGE_LABEL: Record<ActRange, string> = { today: "Today", "7d": "7 days", "30d": "30 days", all: "All time" };

export default function DashboardPage() {
  const isAdmin = useIsAdmin();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // "Now" for Today / This month / the 14-day chart. Refreshed (with the data)
  // when the app comes back to the screen, so an iPad left open overnight
  // doesn't keep showing yesterday as "Today".
  const [now, setNow] = useState(() => Date.now());
  const lastLoad = useRef(0);

  useEffect(() => {
    const load = () => {
      lastLoad.current = Date.now();
      setNow(Date.now());
      return getStockItems()
        .then((d) => setItems(d))
        .catch((e) => console.error(e))
        .finally(() => setLoading(false));
    };
    load();
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const dayChanged = new Date(lastLoad.current).toDateString() !== new Date().toDateString();
      if (dayChanged || Date.now() - lastLoad.current > 5 * 60_000) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const startToday = useMemo(() => { const n = new Date(now); return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime(); }, [now]);
  const startMonth = useMemo(() => { const n = new Date(now); return new Date(n.getFullYear(), n.getMonth(), 1).getTime(); }, [now]);

  const stats = useMemo(() => {
    let inStock = 0, sold = 0, soldToday = 0, soldMonth = 0, addedToday = 0, addedMonth = 0, stockValue = 0;
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
        if (s >= startMonth) soldMonth++;
      } else {
        inStock++;
        if (it.price) stockValue += Number(it.price);
      }
    }
    return { total: items.length, inStock, sold, soldToday, soldMonth, addedToday, addedMonth, stockValue, folders: folders.size };
  }, [items, startToday, startMonth]);

  // Per-staff activity this month (admin view).
  const staffActivity = useMemo(() => {
    const map = new Map<string, { added: number; sold: number }>();
    const bump = (who: string | undefined, key: "added" | "sold") => {
      if (!who) return;
      const cur = map.get(who) || { added: 0, sold: 0 };
      cur[key]++;
      map.set(who, cur);
    };
    for (const it of items) {
      const c = it.created_at ? new Date(it.created_at).getTime() : 0;
      if (c >= startMonth) bump(it.created_by, "added");
      if (it.status === "sold" && it.sold_at && new Date(it.sold_at).getTime() >= startMonth) bump(it.sold_by, "sold");
    }
    return Array.from(map.entries())
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.added + b.sold - (a.added + a.sold));
  }, [items, startMonth]);

  const allEvents = useMemo(() => {
    const events: { type: "added" | "sold"; at: number; who?: string; item: StockItem }[] = [];
    for (const it of items) {
      if (it.created_at) events.push({ type: "added", at: new Date(it.created_at).getTime(), who: it.created_by, item: it });
      if (it.status === "sold" && it.sold_at) events.push({ type: "sold", at: new Date(it.sold_at).getTime(), who: it.sold_by, item: it });
    }
    events.sort((a, b) => b.at - a.at);
    return events;
  }, [items]);

  const [activitySearch, setActivitySearch] = useState("");
  const [actType, setActType] = useState<ActType>("all");
  const [actRange, setActRange] = useState<ActRange>("all");
  const [actWho, setActWho] = useState("all");
  const RENDER_CAP = 200;

  // Everyone who has added or sold something — for the person filter.
  const people = useMemo(
    () => Array.from(new Set(allEvents.map((e) => e.who).filter(Boolean) as string[])).sort(),
    [allEvents]
  );

  // Events matching period + person + search. The added/sold filter is applied
  // after, so its chips can show how many of each there are.
  const scopedActivity = useMemo(() => {
    const day = 86400000;
    const from =
      actRange === "today" ? startToday
      : actRange === "7d" ? startToday - 6 * day
      : actRange === "30d" ? startToday - 29 * day
      : 0;
    const q = activitySearch.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (e.at < from) return false;
      if (actWho !== "all" && e.who !== actWho) return false;
      if (!q) return true;
      return [e.item.code, e.item.category, e.item.label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allEvents, actRange, actWho, activitySearch, startToday]);

  const typeCounts = useMemo(() => {
    let added = 0, sold = 0;
    for (const e of scopedActivity) e.type === "added" ? added++ : sold++;
    return { all: scopedActivity.length, added, sold };
  }, [scopedActivity]);

  const filteredActivity = useMemo(() => {
    const base = actType === "all" ? scopedActivity : scopedActivity.filter((e) => e.type === actType);
    return { total: base.length, rows: base.slice(0, RENDER_CAP) };
  }, [scopedActivity, actType]);

  const filtersOn = actType !== "all" || actRange !== "all" || actWho !== "all" || !!activitySearch.trim();
  const clearFilters = () => {
    setActType("all");
    setActRange("all");
    setActWho("all");
    setActivitySearch("");
  };

  const daily = useMemo(() => {
    const today = new Date(now);
    const days: { label: string; added: number; sold: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const start = d.getTime();
      const end = start + 86400000;
      let added = 0, sold = 0;
      for (const it of items) {
        const c = it.created_at ? new Date(it.created_at).getTime() : 0;
        if (c >= start && c < end) added++;
        if (it.status === "sold" && it.sold_at) { const s = new Date(it.sold_at).getTime(); if (s >= start && s < end) sold++; }
      }
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, added, sold });
    }
    return days;
  }, [items, now]);

  const maxBar = Math.max(1, ...daily.map((d) => Math.max(d.added, d.sold)));

  if (loading) {
    return <div><h1 className="mb-6 text-2xl font-bold">Dashboard</h1><p className="py-12 text-center text-gray-400">Loading activity…</p></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="In Stock" value={stats.inStock} accent="text-green-600" href="/staff/inventory" />
          <Stat label="Sold (total)" value={stats.sold} accent="text-gray-700" href="/staff/inventory" />
          <Stat label="Sold this month" value={stats.soldMonth} sub={stats.soldToday ? `${stats.soldToday} today` : undefined} accent="text-blue-600" />
          <Stat label="Added this month" value={stats.addedMonth} sub={stats.addedToday ? `${stats.addedToday} today` : undefined} accent="text-indigo-600" />
          <Stat label="Stock value" value={inr(stats.stockValue)} accent="text-emerald-600" />
          <Stat label="Folders" value={stats.folders} accent="text-gray-700" href="/staff/collections" />
        </div>
      )}

      {/* Staff activity — admin only */}
      {isAdmin && (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Staff activity (this month)</h2>
          {staffActivity.length === 0 ? (
            <p className="text-sm text-gray-400">
              No staff activity yet — it appears here once staff add or sell sarees with their own logins.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {staffActivity.map((s) => (
                <div key={s.email} className="flex items-center justify-between rounded-md border bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-medium">{displayName(s.email)}</p>
                    <p className="text-[11px] text-gray-400">{s.email}</p>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span className="text-indigo-600"><b>{s.added}</b> added</span>
                    <span className="text-green-600"><b>{s.sold}</b> sold</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manage staff — owner only (the API re-checks this server-side) */}
      {isAdmin && <ManageStaff />}

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        {isAdmin && (
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
        )}

        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {actType === "added" ? "Recently added sarees" : actType === "sold" ? "Recently sold" : "Recent activity"}
            </h2>
            <span className="text-xs text-gray-400">
              {filtersOn ? `${filteredActivity.total} of ${allEvents.length}` : `${allEvents.length} total`}
              {filtersOn && (
                <button className="ml-2 text-primary underline" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </span>
          </div>

          {/* What: all / added / sold */}
          <div className="mb-2 flex flex-wrap gap-2">
            {([
              ["all", "All", typeCounts.all],
              ["added", "Recently added", typeCounts.added],
              ["sold", "Sold", typeCounts.sold],
            ] as [ActType, string, number][]).map(([key, label, n]) => (
              <Button
                key={key}
                size="sm"
                variant={actType === key ? "default" : "outline"}
                onClick={() => setActType(key)}
              >
                {label} <span className="ml-1 opacity-70">{n}</span>
              </Button>
            ))}
          </div>

          {/* When + who */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {(Object.keys(RANGE_LABEL) as ActRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setActRange(r)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  actRange === r ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {RANGE_LABEL[r]}
              </button>
            ))}
            {people.length > 0 && (
              <select
                value={actWho}
                onChange={(e) => setActWho(e.target.value)}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-600"
                aria-label="Filter by person"
              >
                <option value="all">Everyone</option>
                {people.map((p) => (
                  <option key={p} value={p}>
                    {displayName(p)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <Input
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            placeholder="Search a QR code, folder or label…"
            className="mb-3"
          />
          {filteredActivity.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {filtersOn ? "Nothing matches these filters." : "No activity yet."}
            </p>
          ) : (
            <>
              <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {filteredActivity.rows.map((e, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded border bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={e.item.image} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        {e.who ? <span className="font-medium">{displayName(e.who)} </span> : null}
                        <span className={e.type === "sold" ? "font-semibold text-green-700" : "font-semibold text-indigo-700"}>
                          {e.type === "sold" ? "sold" : "added"}
                        </span>{" "}
                        <span className="font-mono text-xs">{e.item.code || "—"}</span>
                        {e.item.category ? <span className="text-gray-500"> · {e.item.category}</span> : null}
                        {isAdmin && e.type === "sold" && e.item.price != null ? <span className="text-gray-500"> · {inr(Number(e.item.price))}</span> : null}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {format(new Date(e.at), "d MMM yyyy, h:mm a")} · {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {filteredActivity.total > filteredActivity.rows.length && (
                <p className="mt-2 text-center text-xs text-gray-400">
                  Showing the latest {filteredActivity.rows.length} of {filteredActivity.total}. Narrow the filters or search a code to find older ones.
                </p>
              )}
            </>
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
