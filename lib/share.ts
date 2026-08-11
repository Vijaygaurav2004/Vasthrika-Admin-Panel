import { StockItem } from "@/types/stock-item";

const SHARE_TITLE = "Satyakrupa Silks Sarees";

export function buildCaption(items: StockItem[]): string {
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

export function whatsappTextLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Download a saree photo as a File (for the native share sheet). */
export async function fetchItemFile(item: StockItem): Promise<File | null> {
  try {
    // Cache-bust so this CORS fetch never reuses the <img> tag's cached
    // non-CORS response (which would fail CORS and yield no file to share).
    const sep = item.image.includes("?") ? "&" : "?";
    const res = await fetch(`${item.image}${sep}share=1`, {
      mode: "cors",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const base = (item.code || item.label || "saree").replace(/[^\w.-]+/g, "_");
    return new File([blob], `${base}.${ext}`, { type: blob.type || "image/jpeg" });
  } catch {
    return null;
  }
}

export type ShareResult = "shared" | "cancelled" | "text" | "empty";

/**
 * Share sarees to WhatsApp / the native share sheet.
 *
 * IMPORTANT: pass `readyFiles` that were fetched BEFORE the share tap. Calling
 * navigator.share() straight after an await of image downloads makes iOS/Android
 * treat the user gesture as expired and silently reject the share. With the files
 * already in hand, share() fires inside the tap and the sheet opens reliably.
 */
export async function shareSarees(
  items: StockItem[],
  readyFiles?: File[]
): Promise<ShareResult> {
  if (items.length === 0) return "empty";
  const text = buildCaption(items);
  const hasCanShare =
    typeof navigator !== "undefined" && typeof navigator.canShare === "function";
  const hasShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Use caller-managed files (from the hook) as-is — this keeps the share
  // firing synchronously inside the tap, which iOS requires. Only fetch inline
  // when no files were managed by the caller (legacy direct calls).
  let files = readyFiles ?? [];
  if (readyFiles === undefined && files.length === 0 && hasCanShare) {
    files = (await Promise.all(items.slice(0, 10).map(fetchItemFile))).filter(
      Boolean
    ) as File[];
  }

  if (files.length > 0 && hasCanShare && hasShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, text, title: SHARE_TITLE });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelled"; // user closed sheet
      // any other error: fall through to the text link
    }
  }

  // Fallback: WhatsApp text link (navigation is not popup-blocked).
  const link = whatsappTextLink(text);
  const win = window.open(link, "_blank");
  if (!win) window.location.href = link;
  return "text";
}

/** Backwards-compatible helper (fetches inline; prefer the hook for reliability). */
export async function shareItemsToWhatsApp(items: StockItem[]): Promise<void> {
  await shareSarees(items);
}
