"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";

interface LabelData {
  code: string;
  dataUrl: string;
}

export default function LabelsPage() {
  const [prefix, setPrefix] = useState("VS");
  const [startNumber, setStartNumber] = useState(1);
  const [quantity, setQuantity] = useState(24);
  const [perRow, setPerRow] = useState(4);
  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generating, setGenerating] = useState(false);

  const pad = (n: number) => String(n).padStart(6, "0");

  // After printing, move the Start number to just after the last printed code,
  // so the next batch continues without ever repeating a code.
  const printSheet = () => {
    window.print();
    if (labels.length === 0) return;
    const lastCode = labels[labels.length - 1].code;
    const lastNum = parseInt(lastCode.split("-").pop() || "", 10);
    if (!Number.isNaN(lastNum)) {
      setStartNumber(lastNum + 1);
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
    </div>
  );
}
