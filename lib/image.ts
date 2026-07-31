/**
 * Compress/resize an image in the browser before upload so photos take far
 * less storage. A typical phone photo (~3 MB) becomes ~150–300 KB with no
 * visible loss for cataloguing. Falls back to the original file on any error
 * or if compression wouldn't help.
 */
export async function compressImage(
  file: File,
  maxDim = 1400,
  quality = 0.72
): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;

    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality)
    );
    // Keep the original if compression failed or didn't actually shrink it.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
