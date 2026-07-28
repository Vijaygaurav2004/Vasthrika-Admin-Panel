import { StockItem } from "@/types/stock-item";

function buildCaption(items: StockItem[]): string {
  return items
    .map((i) => {
      const attrs = [i.color, i.pattern, i.fabric].filter(Boolean).join(", ");
      return (
        `• ${i.label || "Saree"}${i.code ? ` (${i.code})` : ""}` +
        `${attrs ? ` — ${attrs}` : ""}` +
        `${i.price != null ? ` — ₹${i.price}` : ""}`
      );
    })
    .join("\n");
}

/**
 * Share sarees to WhatsApp. On phones/iPads this opens the native share sheet
 * with the actual photos attached; elsewhere it falls back to a WhatsApp text
 * link with the details.
 */
export async function shareItemsToWhatsApp(items: StockItem[]): Promise<void> {
  if (items.length === 0) return;
  const text = buildCaption(items);

  try {
    const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
    if (nav.canShare) {
      const files = await Promise.all(
        items.slice(0, 10).map(async (i) => {
          const res = await fetch(i.image);
          const blob = await res.blob();
          return new File([blob], `${i.code || "saree"}.jpg`, {
            type: blob.type || "image/jpeg",
          });
        })
      );
      if (nav.canShare({ files })) {
        await navigator.share({ files, text, title: "Vasthrika Sarees" });
        return;
      }
    }
  } catch {
    /* fall through to text link */
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
}
