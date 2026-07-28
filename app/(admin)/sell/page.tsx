"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { QrScanner } from "@/components/admin/qr-scanner";
import { StockItem } from "@/types/stock-item";

export default function SellPage() {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [current, setCurrent] = useState<StockItem | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [working, setWorking] = useState(false);
  const [soldThisSession, setSoldThisSession] = useState<StockItem[]>([]);

  const lookup = async (code: string) => {
    setLookupError(null);
    setCurrent(null);
    try {
      const res = await fetch(`/api/sell?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.status === 404) {
        setLookupError(`No saree found for code ${code}. Is it registered in Inventory?`);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      if (data.item.status === "sold") {
        setLookupError(`${code} is already marked SOLD.`);
        return;
      }
      setCurrent(data.item);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    }
  };

  const handleScan = (code: string) => {
    setScanning(false);
    lookup(code.trim());
  };

  const handleManualLookup = () => {
    if (!manualCode.trim()) return;
    lookup(manualCode.trim());
    setManualCode("");
  };

  const markSold = async () => {
    if (!current?.code) return;
    setWorking(true);
    try {
      const res = await fetch("/api/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: current.code,
          buyer_name: buyerName,
          buyer_phone: buyerPhone,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Marked as sold", description: `${current.code} is now sold.` });
      setSoldThisSession((prev) => [data.item, ...prev]);
      setCurrent(null);
      setBuyerName("");
      setBuyerPhone("");
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to mark sold",
        variant: "destructive",
      });
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sell / Stock Out</h1>
        <p className="mt-1 text-gray-500">
          Scan each sold saree&apos;s QR code to mark it sold. Nothing is deleted — sold
          sarees move to the Sold list.
        </p>
      </div>

      {/* Scan trigger */}
      {!current && (
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <Button size="lg" className="w-full sm:w-auto" onClick={() => setScanning(true)}>
            📷 Scan saree QR
          </Button>
          <div className="mt-4 flex items-center gap-2">
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="…or type a code e.g. VS-000001"
              onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
            />
            <Button variant="outline" onClick={handleManualLookup}>
              Find
            </Button>
          </div>
          {lookupError && (
            <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{lookupError}</p>
          )}
        </div>
      )}

      {/* Confirm sale */}
      {current && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-md border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.image} alt={current.label || "Saree"} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold">{current.code}</p>
              {current.label && <p className="text-sm text-gray-700">{current.label}</p>}
              <p className="mt-1 text-xs text-gray-500">
                {[current.color, current.pattern, current.fabric].filter(Boolean).join(" · ") || "No attributes"}
              </p>
              {current.price != null && (
                <p className="mt-1 text-sm font-medium">₹{current.price}</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="buyerName">Buyer name (optional)</Label>
              <Input id="buyerName" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="buyerPhone">Buyer phone (optional)</Label>
              <Input id="buyerPhone" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <Button className="flex-1" onClick={markSold} disabled={working}>
              {working ? "Saving…" : "✓ Mark as Sold"}
            </Button>
            <Button variant="outline" onClick={() => { setCurrent(null); setBuyerName(""); setBuyerPhone(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Session log */}
      {soldThisSession.length > 0 && (
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">
            Sold in this session ({soldThisSession.length})
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {soldThisSession.map((item) => (
              <div key={item.id} className="overflow-hidden rounded-md border">
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.image} alt={item.code || "Saree"} className="h-full w-full object-cover" />
                </div>
                <p className="truncate p-1 text-center font-mono text-[10px]">{item.code}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {scanning && <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />}
    </div>
  );
}
