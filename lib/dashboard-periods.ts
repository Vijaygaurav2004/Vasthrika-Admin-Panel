import { format } from "date-fns";

// Dashboard periods and chart buckets — pure functions, no React.

// ---- Periods: one selection drives the whole dashboard ---------------------

export type PeriodKey =
  | "today" | "yesterday" | "7d" | "this_month" | "last_month" | "this_year" | "all"
  | "month" | "custom";

export const PRESETS: [PeriodKey, string][] = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "7 days"],
  ["this_month", "This month"],
  ["last_month", "Last month"],
  ["this_year", "This year"],
  ["all", "All time"],
];

export interface Period {
  key: PeriodKey;
  label: string; // "Last month", "October 2026", …
  range: string; // "1 Oct – 31 Oct 2026"
  from: number; // inclusive
  to: number; // exclusive (Infinity for all time)
}

// Calendar maths in local time (so "today" means the shop's today).
export const dayStart = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};
export const addDays = (t: number, n: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};
export const monthStart = (y: number, m: number) => new Date(y, m, 1).getTime();
export const toInputDate = (t: number) => format(new Date(t), "yyyy-MM-dd");
export const fromInputDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime();
};

export function rangeText(from: number, to: number): string {
  if (to === Infinity) return "everything so far";
  const last = to - 1;
  if (dayStart(from) === dayStart(last)) return format(new Date(from), "d MMM yyyy");
  const sameYear = new Date(from).getFullYear() === new Date(last).getFullYear();
  return `${format(new Date(from), sameYear ? "d MMM" : "d MMM yyyy")} – ${format(new Date(last), "d MMM yyyy")}`;
}

export function resolvePeriod(key: PeriodKey, now: number, pickedMonth: string, customFrom: string, customTo: string): Period {
  const today = dayStart(now);
  const n = new Date(now);
  const y = n.getFullYear();
  const m = n.getMonth();
  const mk = (label: string, from: number, to: number): Period => ({ key, label, range: rangeText(from, to), from, to });

  switch (key) {
    case "today":
      return mk("Today", today, addDays(today, 1));
    case "yesterday":
      return mk("Yesterday", addDays(today, -1), today);
    case "7d":
      return mk("Last 7 days", addDays(today, -6), addDays(today, 1));
    case "this_month":
      return mk(`This month (${format(n, "MMM yyyy")})`, monthStart(y, m), monthStart(y, m + 1));
    case "last_month":
      return mk(`Last month (${format(new Date(monthStart(y, m - 1)), "MMM yyyy")})`, monthStart(y, m - 1), monthStart(y, m));
    case "this_year":
      return mk(`This year (${y})`, monthStart(y, 0), monthStart(y + 1, 0));
    case "month": {
      const [py, pm] = pickedMonth.split("-").map(Number);
      const from = monthStart(py, pm - 1);
      return mk(format(new Date(from), "MMMM yyyy"), from, monthStart(py, pm));
    }
    case "custom": {
      let a = fromInputDate(customFrom);
      let b = fromInputDate(customTo);
      if (a > b) [a, b] = [b, a];
      return mk(a === b ? format(new Date(a), "EEE d MMM yyyy") : "Custom dates", a, addDays(b, 1));
    }
    default:
      return mk("All time", 0, Infinity);
  }
}

// ---- Chart buckets: by hour (one day), by day (≤ ~2 months), else by month --

export interface Bucket {
  start: number; // bucket start — tap a bar to open that day / month
  label: string;
  title: string;
  added: number;
  sold: number;
}

export function buildBuckets(
  period: Period,
  rows: { c?: number; s?: number }[],
  now: number,
  earliest: number | null
): { unit: "hour" | "day" | "month"; buckets: Bucket[] } {
  const from = period.from === 0 ? dayStart(earliest ?? now) : period.from;
  // Never draw the future (e.g. the rest of this month).
  const to = Math.min(period.to, addDays(dayStart(now), 1));
  if (to <= from) return { unit: "day", buckets: [] };
  const days = Math.round((to - from) / 86400000);

  let unit: "hour" | "day" | "month";
  let buckets: Bucket[];
  let indexOf: (t: number) => number;

  if (days <= 1) {
    unit = "hour";
    buckets = Array.from({ length: 24 }, (_, h) => {
      const t = new Date(from);
      t.setHours(h);
      const end = new Date(t);
      end.setHours(h + 1);
      return {
        start: t.getTime(),
        label: h % 3 === 0 ? format(t, "ha").toLowerCase() : "",
        title: `${format(t, "h a")} – ${format(end, "h a")}`,
        added: 0,
        sold: 0,
      };
    });
    indexOf = (t) => new Date(t).getHours();
  } else if (days <= 62) {
    unit = "day";
    const starts: number[] = [];
    for (let t = from; t < to; t = addDays(t, 1)) starts.push(t);
    const step = Math.ceil(starts.length / 12);
    buckets = starts.map((t, i) => ({
      start: t,
      label: i % step === 0 ? format(new Date(t), "d/M") : "",
      title: format(new Date(t), "EEE d MMM"),
      added: 0,
      sold: 0,
    }));
    const pos = new Map(starts.map((t, i) => [t, i]));
    indexOf = (t) => pos.get(dayStart(t)) ?? -1;
  } else {
    unit = "month";
    const f = new Date(from);
    const l = new Date(to - 1);
    const first = f.getFullYear() * 12 + f.getMonth();
    const count = l.getFullYear() * 12 + l.getMonth() - first + 1;
    const step = Math.ceil(count / 12);
    buckets = Array.from({ length: count }, (_, i) => {
      const t = new Date(Math.floor((first + i) / 12), (first + i) % 12, 1);
      return { start: t.getTime(), label: i % step === 0 ? format(t, "MMM yy") : "", title: format(t, "MMMM yyyy"), added: 0, sold: 0 };
    });
    indexOf = (t) => {
      const d = new Date(t);
      return d.getFullYear() * 12 + d.getMonth() - first;
    };
  }

  for (const r of rows) {
    if (r.c !== undefined && r.c >= from && r.c < to) {
      const i = indexOf(r.c);
      if (buckets[i]) buckets[i].added++;
    }
    if (r.s !== undefined && r.s >= from && r.s < to) {
      const i = indexOf(r.s);
      if (buckets[i]) buckets[i].sold++;
    }
  }
  return { unit, buckets };
}
