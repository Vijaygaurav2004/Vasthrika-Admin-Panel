import { useCallback, useRef, useState } from "react";
import { StockItem } from "@/types/stock-item";
import { fetchItemFile, shareSarees, ShareResult } from "./share";

/**
 * WhatsApp share with photo pre-fetching.
 *
 * Call `prefetch(item)` when a saree is selected — its photo downloads in the
 * background. `isReady(items)` reports when every selected saree's photo is in
 * hand; gate the Share button on it so the share fires instantly inside the tap
 * (iOS cancels a share if photos are still downloading when it starts).
 */
export function useWhatsappShare() {
  const cache = useRef<Map<string, File>>(new Map());
  const inflight = useRef<Set<string>>(new Set());
  const [settled, setSettled] = useState<Set<string>>(new Set());
  const [sharing, setSharing] = useState(false);

  const prefetch = useCallback((item: StockItem) => {
    const id = item.id;
    if (!id || cache.current.has(id) || inflight.current.has(id)) return;
    inflight.current.add(id);
    fetchItemFile(item).then((f) => {
      if (f) cache.current.set(id, f);
      setSettled((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    });
  }, []);

  // True once every selected saree's photo download has finished (success or not).
  const isReady = useCallback(
    (items: StockItem[]) =>
      items.length > 0 && items.every((i) => i.id != null && settled.has(i.id)),
    [settled]
  );

  // WhatsApp / the OS share sheet accept only a handful of photos per share
  // (about 10). Share one batch per tap and report what's left.
  const BATCH = 10;

  const share = useCallback(
    async (items: StockItem[]): Promise<{ result: ShareResult; shared: StockItem[] }> => {
      setSharing(true);
      try {
        const batch = items.slice(0, BATCH);
        const files = batch
          .map((i) => (i.id ? cache.current.get(i.id) : undefined))
          .filter(Boolean) as File[];
        // Always pass managed files (even if partial) so no await happens before
        // navigator.share() — keeps the iOS user gesture alive.
        const result = await shareSarees(batch, files);
        const shared = result === "shared" || result === "text" ? batch : [];
        return { result, shared };
      } finally {
        setSharing(false);
      }
    },
    []
  );

  return { prefetch, isReady, share, sharing, batchSize: BATCH };
}
