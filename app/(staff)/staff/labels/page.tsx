"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { getMaxCodeNumber, getRecentCodesByPrefix } from "@/lib/supabase/stock-items";
import { logQrPrint, getQrPrintHistory, QrPrintBatch } from "@/lib/supabase/print-log";
import { StockItem } from "@/types/stock-item";
import { useActor } from "@/lib/use-role";

interface LabelData {
  code: string;
  dataUrl: string;
}

export default function LabelsPage() {
  const actor = useActor();
  const [prefix, setPrefix] = useState("VS");
  const [startNumber, setStartNumber] = useState(1);
  const [quantity, setQuantity] = useState(24);
  const [perRow, setPerRow] = useState(4);
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [printHistory, setPrintHistory] = useState<QrPrintBatch[]>([]);
  const [usedCodes, setUsedCodes] = useState<StockItem[]>([]);

  const pad = (n: number) => String(n).padStart(6, "0");
  const lsKey = (p: string) => `qr_next_start_${p.trim().toUpperCase()}`;

  // When the prefix changes (and on first load), continue from the highest
  // code already used for that prefix in the database — plus anything printed
  // ahead on this device (localStorage) — so it never restarts at 1.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const p = prefix.trim().toUpperCase();
      if (!p) return;
      let ls = 0;
      try {
        const v = window.localStorage.getItem(lsKey(p));
        if (v) ls = parseInt(v, 10) || 0;
      } catch {
        /* ignore */
      }
      let dbMax = 0;
      try {
        dbMax = await getMaxCodeNumber(p);
      } catch {
        /* ignore */
      }
      const next = Math.max(dbMax + 1, ls, 1);
      if (!cancelled) setStartNumber(next);
      try {
        const rows = await getRecentCodesByPrefix(p, 200);
        if (!cancelled) setUsedCodes(rows);
      } catch {
        if (!cancelled) setUsedCodes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prefix]);

  const loadPrintHistory = () => {
    getQrPrintHistory().then(setPrintHistory).catch(() => setPrintHistory([]));
  };
  useEffect(() => {
    loadPrintHistory();
  }, []);

  // After printing, continue at the next unused number and remember it on this
  // device (so codes never repeat, even before the labels are scanned in).
  const printSheet = () => {
    window.print();
    if (labels.length === 0) return;
    const firstNum = parseInt(labels[0].code.split("-").pop() || "", 10);
    const lastNum = parseInt(labels[labels.length - 1].code.split("-").pop() || "", 10);
    if (!Number.isNaN(lastNum)) {
      const nextStart = lastNum + 1;
      setStartNumber(nextStart);
      try {
        window.localStorage.setItem(lsKey(prefix), String(nextStart));
      } catch {
        /* ignore */
      }
      // Record this print batch in the QR history.
      logQrPrint({
        prefix: prefix.trim().toUpperCase(),
        from_number: firstNum,
        to_number: lastNum,
        count: labels.length,
        printed_by: actor || null,
      })
        .then(() => loadPrintHistory())
        .catch(() => {});
    }
  };

  const generate = async () => {
    if (quantity < 1 || quantity > 500) {
      toast({
        title: "Pick 1–500 labels",
        description: "Generate up to 500 QR labels at a time.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const next: LabelData[] = [];
      for (let i = 0; i < quantity; i++) {
        const code = `${prefix.trim().toUpperCase()}-${pad(startNumber + i)}`;
        const dataUrl = await QRCode.toDataURL(code, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 240,
        });
        next.push({ code, dataUrl });
      }
      setLabels(next);
    } catch (err) {
      console.error(err);
      toast({ title: "Could not generate", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Print styles: hide everything except the label sheet when printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #qr-print-area,
          #qr-print-area * {
            visibility: visible;
          }
          #qr-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .qr-label {
            break-inside: avoid;
          }
        }
      `}</style>

      {/* Controls */}
      <div className="rounded-lg border bg-white p-6 shadow-sm print:hidden">
        <h2 className="mb-1 text-lg font-semibold">QR Label Generator</h2>
        <p className="mb-5 text-sm text-gray-500">
          Print these on a sticker sheet, stick one on each saree, then scan it in
          the Inventory screen to register the saree. Each code is unique.
        </p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <Label htmlFor="prefix">Prefix</Label>
            <Input
              id="prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="VS"
            />
          </div>
          <div>
            <Label htmlFor="start">Start number</Label>
            <Input
              id="start"
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value)))}
            />
            <p className="mt-1 text-[11px] text-gray-400">Auto-filled to continue from the last code — change it if you want.</p>
          </div>
          <div>
            <Label htmlFor="qty">How many</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={500}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="perRow">Per row</Label>
            <Input
              id="perRow"
              type="number"
              min={2}
              max={6}
              value={perRow}
              onChange={(e) => setPerRow(Math.min(6, Math.max(2, Number(e.target.value))))}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={generate} disabled={generating}>
            {generating ? "Generating…" : "Generate labels"}
          </Button>
          {labels.length > 0 && (
            <Button variant="outline" onClick={printSheet}>
              Print sheet
            </Button>
          )}
          {labels.length > 0 && (
            <span className="text-sm text-gray-500">
              {labels.length} labels ready ({labels[0].code} –{" "}
              {labels[labels.length - 1].code})
            </span>
          )}
        </div>
      </div>

      {/* Printable sheet */}
      {labels.length > 0 && (
        <div id="qr-print-area" className="rounded-lg border bg-white p-6 shadow-sm">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))` }}
          >
            {labels.map((l) => (
              <div
                key={l.code}
                className="qr-label flex flex-col items-center justify-center rounded-md border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.dataUrl} alt={l.code} className="h-auto w-full max-w-[140px]" />
                <span className="mt-1 font-mono text-xs font-semibold tracking-wide">
                  {l.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR print history */}
      <div className="rounded-lg border bg-white p-6 shadow-sm print:hidden">
        <h2 className="text-lg font-semibold">QR print history</h2>
        <p className="mb-4 text-sm text-gray-500">
          Every sheet you print is recorded here — the number range, how many, and when.
        </p>
        {printHistory.length === 0 ? (
          <p className="text-sm text-gray-400">No sheets printed yet. Print a sheet and it shows up here.</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-gray-400">
                <tr>
                  <th className="py-1 font-medium">Range printed</th>
                  <th className="font-medium">Qty</th>
                  <th className="font-medium">By</th>
                  <th className="font-medium">Printed at</th>
                </tr>
              </thead>
              <tbody>
                {printHistory.map((b) => {
                  const p = (b.prefix || "").toUpperCase();
                  return (
                    <tr key={b.id} className="border-t">
                      <td className="whitespace-nowrap py-1.5 font-mono text-xs font-semibold">
                        {p}-{pad(b.from_number)} → {p}-{pad(b.to_number)}
                      </td>
                      <td className="text-gray-600">{b.count}</td>
                      <td className="text-gray-500">{b.printed_by ? b.printed_by.split("@")[0] : "—"}</td>
                      <td className="whitespace-nowrap text-gray-500">
                        {b.printed_at ? format(new Date(b.printed_at), "d MMM yyyy, h:mm a") : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Codes already used (past + present) for this prefix */}
      <div className="rounded-lg border bg-white p-6 shadow-sm print:hidden">
        <h2 className="text-lg font-semibold">Codes already used — {prefix.trim().toUpperCase() || "—"}</h2>
        <p className="mb-4 text-sm text-gray-500">
          Every code already registered for this prefix (newest first) — including from before. Don&apos;t reuse these.
        </p>
        {usedCodes.length === 0 ? (
          <p className="text-sm text-gray-400">No codes used yet for this prefix.</p>
        ) : (
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-gray-400">
                <tr>
                  <th className="py-1 font-medium">Code</th>
                  <th className="font-medium">Folder</th>
                  <th className="font-medium">Status</th>
                  <th className="font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {usedCodes.map((h) => (
                  <tr key={h.code} className="border-t">
                    <td className="whitespace-nowrap py-1.5 font-mono text-xs font-semibold">{h.code}</td>
                    <td className="text-gray-600">{h.category || "—"}</td>
                    <td>
                      {h.status === "sold" ? (
                        <span className="text-red-600">Sold</span>
                      ) : (
                        <span className="text-green-600">In stock</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-gray-500">
                      {h.created_at ? format(new Date(h.created_at), "d MMM yyyy, h:mm a") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
