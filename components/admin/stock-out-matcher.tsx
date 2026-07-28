"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

interface MatchResult {
  item_id: string;
  label: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  thumbnail: string;
}

interface MatchResponse {
  total_sarees_detected: number;
  matches: MatchResult[];
  unmatched_count: number;
}

interface StockOutMatcherProps {
  results: MatchResponse;
  groupPhotoUrl: string;
  onComplete: () => void;
}

const confidenceStyles = {
  high: "bg-green-100 text-green-800 border-green-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-red-100 text-red-800 border-red-300",
};

const confidenceLabels = {
  high: "High Match",
  medium: "Medium Match",
  low: "Low Match",
};

export default function StockOutMatcher({
  results,
  groupPhotoUrl,
  onComplete,
}: StockOutMatcherProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(
      results.matches
        .filter((m) => m.confidence === "high")
        .map((m) => m.item_id)
    )
  );
  const [marking, setMarking] = useState(false);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(results.matches.map((m) => m.item_id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleMarkAsSold = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "No items selected", description: "Select at least one item.", variant: "destructive" });
      return;
    }

    setMarking(true);
    try {
      const response = await fetch("/api/stock-out", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      toast({ title: "Done", description: `${data.updated} item(s) marked as sold.` });
      onComplete();
    } catch (error) {
      toast({ title: "Error", description: "Failed to mark as sold.", variant: "destructive" });
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Sarees Detected</p>
          <p className="text-2xl font-bold">{results.total_sarees_detected}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Matches Found</p>
          <p className="text-2xl font-bold text-green-600">{results.matches.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Unmatched</p>
          <p className="text-2xl font-bold text-orange-500">{results.unmatched_count}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Group Photo</h3>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md">
            <Image src={groupPhotoUrl} alt="Group photo" fill className="object-contain" unoptimized />
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Matched Items ({results.matches.length})</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
            </div>
          </div>

          {results.matches.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No matches found in inventory.</p>
          ) : (
            <div className="max-h-[500px] space-y-3 overflow-y-auto">
              {results.matches.map((match) => (
                <label
                  key={match.item_id}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                    selectedIds.has(match.item_id) ? "border-primary bg-primary/5" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(match.item_id)}
                    onChange={() => toggleSelection(match.item_id)}
                    className="mt-1 h-4 w-4 rounded border-gray-300"
                  />
                  {match.thumbnail && (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
                      <Image src={match.thumbnail} alt={match.label} fill className="object-cover" sizes="64px" unoptimized />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{match.label}</p>
                      <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${confidenceStyles[match.confidence]}`}>
                        {confidenceLabels[match.confidence]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{match.reasoning}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {results.unmatched_count > 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm text-orange-800">
            <strong>{results.unmatched_count} saree(s)</strong> could not be matched to any inventory item.
          </p>
        </div>
      )}

      {results.matches.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-600">{selectedIds.size} of {results.matches.length} selected</p>
          <Button onClick={handleMarkAsSold} disabled={marking || selectedIds.size === 0} className="bg-red-600 hover:bg-red-700">
            {marking ? "Marking..." : `Mark ${selectedIds.size} as Sold`}
          </Button>
        </div>
      )}
    </div>
  );
}
