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
import {
  PRESETS,
  PeriodKey,
  Bucket,
  resolvePeriod,
  buildBuckets,
  monthStart,
  toInputDate,
} from "@/lib/dashboard-periods";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

type ActType = "all" | "added" | "sold";

export default function DashboardPage() {
  const isAdmin = useIsAdmin();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  // "Now" for Today / This month / the chart. Refreshed (with the data) when
  // the app comes back to the screen, so an iPad left open overnight doesn't
  // keep showing yesterday as "Today".
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

  // ---- Period selection ----
  const [periodKey, setPeriodKey] = useState<PeriodKey>("this_month");
  const [pickedMonth, setPickedMonth] = useState("");
  const [customFrom, setCustomFrom] = useState(() => toInputDate(monthStart(new Date().getFullYear(), new Date().getMonth())));
  const [customTo, setCustomTo] = useState(() => toInputDate(Date.now()));

  const period = useMemo(
    () => resolvePeriod(periodKey, now, pickedMonth, customFrom, customTo),
    [periodKey, now, pickedMonth, customFrom, customTo]
  );
  const inPeriod = (t?: number) => t !== undefined && t >= period.from && t < period.to;

  // Each saree's added/sold time, parsed once.
  const rows = useMemo(
    () =>
      items.map((it) => ({
        it,
        c: it.created_at ? new Date(it.created_at).getTime() : undefined,
        s: it.status === "sold" && it.sold_at ? new Date(it.sold_at).getTime() : undefined,
      })),
    [items]
  );

  const earliest = useMemo(() => {
    let min: number | null = null;
    for (const r of rows) if (r.c !== undefined && (min === null || r.c < min)) min = r.c;
    return min;
  }, [rows]);

  // Every month that has data, newest first — for "Pick a month".
  const months = useMemo(() => {
    if (earliest === null) return [];
    const out: { value: string; label: string }[] = [];
    const n = new Date(now);
    for (let t = monthStart(n.getFullYear(), n.getMonth()); t >= monthStart(new Date(earliest).getFullYear(), new Date(earliest).getMonth()); ) {
      const d = new Date(t);
      out.push({ value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") });
      t = monthStart(d.getFullYear(), d.getMonth() - 1);
    }
    return out;
  }, [earliest, now]);

  // ---- Numbers for the chosen period ----
  const stats = useMemo(() => {
    let sold = 0, added = 0, salesValue = 0, inStock = 0, stockValue = 0;
    const folders = new Set<string>();
    for (const r of rows) {
      if (r.it.category) folders.add(r.it.category);
      if (r.it.status !== "sold") {
        inStock++;
        if (r.it.price) stockValue += Number(r.it.price);
      }
      if (r.c !== undefined && r.c >= period.from && r.c < period.to) added++;
      // All time also counts old sales recorded without a date.
      const soldNow = r.s !== undefined ? r.s >= period.from && r.s < period.to : period.to === Infinity && r.it.status === "sold";
      if (soldNow) {
        sold++;
        if (r.it.price) salesValue += Number(r.it.price);
      }
    }
    return { sold, added, salesValue, inStock, stockValue, folders: folders.size };
  }, [rows, period]);

  // Per-person activity in the period (owner view).
  const staffActivity = useMemo(() => {
    const map = new Map<string, { added: number; sold: number; value: number }>();
    let untracked = 0;
    const get = (who: string) => {
      const cur = map.get(who) || { added: 0, sold: 0, value: 0 };
      map.set(who, cur);
      return cur;
    };
    for (const r of rows) {
      if (r.c !== undefined && r.c >= period.from && r.c < period.to) {
        if (r.it.created_by) get(r.it.created_by).added++;
        else untracked++;
      }
      if (r.s !== undefined && r.s >= period.from && r.s < period.to) {
        if (r.it.sold_by) {
          const cur = get(r.it.sold_by);
          cur.sold++;
          if (r.it.price) cur.value += Number(r.it.price);
        } else untracked++;
      }
    }
    const list = Array.from(map.entries())
      .map(([email, v]) => ({ email, ...v }))
      .sort((a, b) => b.added + b.sold - (a.added + a.sold));
    return { list, untracked };
  }, [rows, period]);

  const chart = useMemo(() => buildBuckets(period, rows, now, earliest), [period, rows, now, earliest]);

  // Chart interaction: tap/hover a bar for its numbers, tap the legend to
  // show/hide a series, and open a day/month to move the whole dashboard there.
  const [activeBar, setActiveBar] = useState<number | null>(null);
  const [showAdded, setShowAdded] = useState(true);
  const [showSold, setShowSold] = useState(true);
  useEffect(() => setActiveBar(null), [period.from, period.to]);

  const maxBar = Math.max(
    1,
    ...chart.buckets.map((b) => Math.max(showAdded ? b.added : 0, showSold ? b.sold : 0))
  );
  const chartTotals = useMemo(
    () => chart.buckets.reduce((t, b) => ({ added: t.added + b.added, sold: t.sold + b.sold }), { added: 0, sold: 0 }),
    [chart]
  );
  const activeBucket = activeBar !== null ? chart.buckets[activeBar] : undefined;

  const openBucket = (b: Bucket) => {
    if (chart.unit === "month") {
      setPickedMonth(format(new Date(b.start), "yyyy-MM"));
      setPeriodKey("month");
    } else if (chart.unit === "day") {
      const d = toInputDate(b.start);
      setCustomFrom(d);
      setCustomTo(d);
      setPeriodKey("custom");
    }
  };

  // ---- Activity feed ----
  const allEvents = useMemo(() => {
    const events: { type: "added" | "sold"; at: number; who?: string; item: StockItem }[] = [];
    for (const r of rows) {
      if (r.c !== undefined) events.push({ type: "added", at: r.c, who: r.it.created_by, item: r.it });
      if (r.s !== undefined) events.push({ type: "sold", at: r.s, who: r.it.sold_by, item: r.it });
    }
    events.sort((a, b) => b.at - a.at);
    return events;
  }, [rows]);

  const [activitySearch, setActivitySearch] = useState("");
  const [actType, setActType] = useState<ActType>("all");
  const [actWho, setActWho] = useState("all");
  const RENDER_CAP = 200;
  const searching = !!activitySearch.trim();

  const people = useMemo(
    () => Array.from(new Set(allEvents.map((e) => e.who).filter(Boolean) as string[])).sort(),
    [allEvents]
  );

  // Period + person + search. A search looks across ALL dates, so you can find
  // when any code was added/sold no matter which period is selected.
  const scopedActivity = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (!q && !(e.at >= period.from && e.at < period.to)) return false;
      if (actWho !== "all" && e.who !== actWho) return false;
      if (!q) return true;
      return [e.item.code, e.item.category, e.item.label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [allEvents, period, actWho, activitySearch]);

  const typeCounts = useMemo(() => {
    let added = 0, sold = 0;
    for (const e of scopedActivity) e.type === "added" ? added++ : sold++;
    return { all: scopedActivity.length, added, sold };
  }, [scopedActivity]);

  const filteredActivity = useMemo(() => {
    const base = actType === "all" ? scopedActivity : scopedActivity.filter((e) => e.type === actType);
    return { total: base.length, rows: base.slice(0, RENDER_CAP) };
  }, [scopedActivity, actType]);

  const feedFiltersOn = actType !== "all" || actWho !== "all" || searching;
  const clearFeedFilters = () => {
    setActType("all");
    setActWho("all");
    setActivitySearch("");
  };

  if (loading) {
    return <div><h1 className="mb-6 text-2xl font-bold">Dashboard</h1><p className="py-12 text-center text-gray-400">Loading activity…</p></div>;
  }

  const short = period.key === "month" || period.key === "custom" ? period.label : PRESETS.find(([k]) => k === period.key)?.[1] || period.label;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Period — drives every section below */}
      <div className="sticky top-0 z-10 -mx-1 rounded-lg border bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriodKey(key)}
              className={`rounded-full border px-3 py-1 text-sm ${
                periodKey === key ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
          <select
            value={periodKey === "month" ? pickedMonth : ""}
            onChange={(e) => {
              if (!e.target.value) return;
              setPickedMonth(e.target.value);
              setPeriodKey("month");
            }}
            className={`rounded-full border px-3 py-1 text-sm ${
              periodKey === "month" ? "border-primary bg-primary text-white" : "border-gray-300 bg-white text-gray-700"
            }`}
            aria-label="Pick a month"
          >
            <option value="">Pick a month…</option>
            {months.map((mo) => (
              <option key={mo.value} value={mo.value}>
                {mo.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => setPeriodKey("custom")}
            className={`rounded-full border px-3 py-1 text-sm ${
              periodKey === "custom" ? "border-primary bg-primary text-white" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Custom dates
          </button>
        </div>
        {periodKey === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-gray-500" htmlFor="from">From</label>
            <input id="from" type="date" value={customFrom} max={toInputDate(now)} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
            <label className="text-gray-500" htmlFor="to">to</label>
            <input id="to" type="date" value={customTo} max={toInputDate(now)} onChange={(e) => e.target.value && setCustomTo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1" />
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Showing <b className="text-gray-700">{period.label}</b> · {period.range}
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label={`Sold · ${short}`} value={stats.sold} accent="text-blue-600" />
          <Stat label={`Added · ${short}`} value={stats.added} accent="text-indigo-600" />
          <Stat label={`Sales value · ${short}`} value={inr(stats.salesValue)} accent="text-emerald-600" />
          <Stat label="In stock now" value={stats.inStock} accent="text-green-600" href="/staff/inventory" />
          <Stat label="Stock value now" value={inr(stats.stockValue)} accent="text-emerald-600" />
          <Stat label="Folders" value={stats.folders} accent="text-gray-700" href="/staff/collections" />
        </div>
      )}

      {/* Staff activity in the period — owner only */}
      {isAdmin && (
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Staff activity · {period.label}</h2>
            {staffActivity.list.length > 0 && <span className="text-xs text-gray-400">Tap a person to see their activity below</span>}
          </div>
          {staffActivity.list.length === 0 ? (
            <p className="text-sm text-gray-400">No one added or sold sarees in this period.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {staffActivity.list.map((s) => {
                const selected = actWho === s.email;
                return (
                  <button
                    key={s.email}
                    onClick={() => setActWho(selected ? "all" : s.email)}
                    className={`flex items-center justify-between rounded-md border px-4 py-3 text-left transition ${
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{displayName(s.email)}</p>
                      <p className="truncate text-[11px] text-gray-400">{s.email}</p>
                    </div>
                    <div className="text-right text-sm">
                      <span className="text-indigo-600"><b>{s.added}</b> added</span>
                      <span className="ml-3 text-green-600"><b>{s.sold}</b> sold</span>
                      {s.value > 0 && <p className="text-[11px] text-gray-500">{inr(s.value)} sold</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {staffActivity.untracked > 0 && (
            <p className="mt-3 text-[11px] text-gray-400">
              + {staffActivity.untracked} entr{staffActivity.untracked === 1 ? "y" : "ies"} from before logins were tracked (no name recorded).
            </p>
          )}
        </div>
      )}

      {/* Manage staff — owner only (the API re-checks this server-side) */}
      {isAdmin && <ManageStaff />}

      <div className={`grid gap-6 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        {isAdmin && (
          <div className="rounded-lg border bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                Added vs sold <span className="text-sm font-normal text-gray-400">· by {chart.unit}</span>
              </h2>
              {/* Legend doubles as a toggle */}
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => setShowAdded((v) => !v || !showSold)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${showAdded ? "text-gray-700" : "text-gray-300 line-through"}`}
                  aria-pressed={showAdded}
                >
                  <span className={`h-2 w-2 rounded-sm ${showAdded ? "bg-indigo-500" : "bg-gray-300"}`} /> Added
                </button>
                <button
                  onClick={() => setShowSold((v) => !v || !showAdded)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 ${showSold ? "text-gray-700" : "text-gray-300 line-through"}`}
                  aria-pressed={showSold}
                >
                  <span className={`h-2 w-2 rounded-sm ${showSold ? "bg-green-500" : "bg-gray-300"}`} /> Sold
                </button>
              </div>
            </div>
            {chart.buckets.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">Nothing to chart for this period.</p>
            ) : (
              <div onMouseLeave={() => setActiveBar(null)}>
                {/* Readout: the tapped/hovered bar, or the period total */}
                <div className="mb-2 flex min-h-[2.25rem] flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-sm">
                  {activeBucket ? (
                    <>
                      <span>
                        <b>{activeBucket.title}</b>
                        <span className="ml-2 text-indigo-600">{activeBucket.added} added</span>
                        <span className="ml-2 text-green-600">{activeBucket.sold} sold</span>
                      </span>
                      {chart.unit !== "hour" && (
                        <button className="text-xs font-medium text-primary underline" onClick={() => openBucket(activeBucket)}>
                          Open this {chart.unit} →
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">
                      Total <span className="text-indigo-600">{chartTotals.added} added</span> ·{" "}
                      <span className="text-green-600">{chartTotals.sold} sold</span>
                      <span className="ml-2 text-xs text-gray-400">Tap a bar for details</span>
                    </span>
                  )}
                </div>
                <div className="relative flex h-40 items-end justify-between gap-px">
                  <span className="pointer-events-none absolute left-0 top-0 text-[9px] text-gray-300">{maxBar}</span>
                  {chart.buckets.map((b, i) => {
                    const dim = activeBar !== null && activeBar !== i;
                    return (
                      <button
                        key={i}
                        type="button"
                        onMouseEnter={() => setActiveBar(i)}
                        onClick={() => setActiveBar(i)}
                        onDoubleClick={() => chart.unit !== "hour" && openBucket(b)}
                        aria-label={`${b.title}: ${b.added} added, ${b.sold} sold`}
                        className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-sm transition-opacity ${
                          activeBar === i ? "bg-gray-100" : ""
                        } ${dim ? "opacity-40" : ""}`}
                      >
                        <div className="flex h-32 w-full items-end justify-center gap-px">
                          {showAdded && (
                            <div className="w-1/2 rounded-t bg-indigo-500" style={{ height: `${(b.added / maxBar) * 100}%` }} />
                          )}
                          {showSold && (
                            <div className="w-1/2 rounded-t bg-green-500" style={{ height: `${(b.sold / maxBar) * 100}%` }} />
                          )}
                        </div>
                        <span className="h-3 whitespace-nowrap text-[9px] text-gray-400">{b.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {actType === "added" ? "Added sarees" : actType === "sold" ? "Sold sarees" : "Activity"}
              <span className="text-sm font-normal text-gray-400"> · {searching ? "all dates" : period.label}</span>
            </h2>
            {feedFiltersOn && (
              <button className="text-xs text-primary underline" onClick={clearFeedFilters}>
                Clear filters
              </button>
            )}
          </div>

          {/* What: all / added / sold */}
          <div className="mb-2 flex flex-wrap gap-2">
            {([
              ["all", "All", typeCounts.all],
              ["added", "Added", typeCounts.added],
              ["sold", "Sold", typeCounts.sold],
            ] as [ActType, string, number][]).map(([key, label, n]) => (
              <Button key={key} size="sm" variant={actType === key ? "default" : "outline"} onClick={() => setActType(key)}>
                {label} <span className="ml-1 opacity-70">{n}</span>
              </Button>
            ))}
            {people.length > 0 && (
              <select
                value={actWho}
                onChange={(e) => setActWho(e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600"
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
            placeholder="Search a QR code, folder or label (searches all dates)…"
            className="mb-3"
          />
          {filteredActivity.rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              {searching ? "No activity matches that search." : "Nothing in this period with these filters."}
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
                  Showing the latest {filteredActivity.rows.length} of {filteredActivity.total}. Pick a shorter period or search a code to see older ones.
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
    <div className="h-full rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent || ""}`}>{value}</p>
      {sub ? <p className="text-[11px] text-gray-400">{sub}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
