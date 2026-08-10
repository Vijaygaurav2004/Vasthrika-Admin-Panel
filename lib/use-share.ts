import { useCallback, useRef, useState } from "react";
import { StockItem } from "@/types/stock-item";
import { fetchItemFile, shareSarees, ShareResult } from "./share";

/**
 * WhatsApp share with photo pre-fetching. Call `prefetch(item)` when a saree is
 * selected so its photo is downloaded ahead of time; then `share(items)` fires
 * navigator.share() instantly within the tap (keeps the user gesture alive so
 * iOS/Android actually open the share sheet).
 */
export function useWhatsappShare() {
  const cache = useRef<Map<string, File>>(new Map());
  const [sharing, setSharing] = useState(false);

  const prefetch = useCallback((item: StockItem) => {
    if (!item.id || cache.current.has(item.id)) return;
    fetchItemFile(item).then((f) => {
      if (f && item.id) cache.current.set(item.id, f);
    });
  }, []);

  const share = useCallback(async (items: StockItem[]): Promise<ShareResult> => {
    setSharing(true);
    try {
      const files = items
        .map((i) => (i.id ? cache.current.get(i.id) : undefined))
        .filter(Boolean) as File[];
      // Only treat as "ready" if we have a photo for every selected saree.
      const ready = files.length === items.length ? files : undefined;
      return await shareSarees(items, ready);
    } finally {
      setSharing(false);
    }
  }, []);

  return { prefetch, share, sharing };
}
