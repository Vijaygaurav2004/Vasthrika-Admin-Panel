import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 photo storage (S3-compatible).
 * Stays dormant until all env vars are set, so the app keeps using Supabase
 * storage until R2 is configured — then it switches automatically.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET, R2_PUBLIC_URL
 */
export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

function publicBase(): string {
  return (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
}

function r2Client(): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });
}

export async function uploadToR2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await r2Client().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET as string,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    })
  );
  return `${publicBase()}/${key}`;
}

/** True if this image URL points at our R2 public bucket. */
export function isR2Url(url: string): boolean {
  const base = publicBase();
  return Boolean(base) && url.startsWith(base);
}

export async function deleteFromR2(url: string): Promise<void> {
  const base = publicBase();
  const key = url.slice(base.length + 1); // strip "base/"
  if (!key) return;
  await r2Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET as string,
      Key: key,
    })
  );
}
