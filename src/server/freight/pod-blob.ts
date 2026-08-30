import { put } from "@vercel/blob";

import { env } from "@/env";

/**
 * Persist a proof-of-delivery photo in the private Vercel Blob store.
 *
 * A POD is the document a carrier gets paid against, so the bytes must outlive
 * the request that carried them. `null` when the store is unconfigured — the
 * caller then tells the driver the photo was not kept rather than pretending
 * a signed URL exists.
 */
export async function storePodBlob(input: {
  loadId: string;
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
}): Promise<{ url: string; pathname: string } | null> {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  const safe = sanitizeFilename(input.filename);
  const pathname = `freight-pod/${sanitizeSegment(input.loadId)}/${Date.now()}-${safe}`;

  try {
    const blob = await put(pathname, Buffer.from(input.bytes), {
      access: "private",
      token,
      contentType: input.mediaType,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  } catch (error) {
    console.info("[pod-blob] put failed", error);
    return null;
  }
}

function sanitizeFilename(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() ?? "pod.jpg";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return cleaned.length > 0 ? cleaned : "pod.jpg";
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 64) || "load";
}
