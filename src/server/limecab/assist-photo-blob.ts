import { put } from "@vercel/blob";

import { env } from "@/env";

/**
 * Persist an Assist compose photo in the private Vercel Blob store so the
 * server can re-read it and keep a durable URL next to the prepared prompt.
 */
export async function storeAssistPhotoBlob(input: {
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
}): Promise<{ url: string; pathname: string } | null> {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) return null;

  const safe = sanitizeFilename(input.filename);
  const pathname = `assist-photos/${Date.now()}-${randomId()}-${safe}`;

  try {
    const blob = await put(pathname, Buffer.from(input.bytes), {
      access: "private",
      token,
      contentType: input.mediaType,
      addRandomSuffix: false,
    });
    return { url: blob.url, pathname: blob.pathname };
  } catch (error) {
    console.info("[assist-photo-blob] put failed", error);
    return null;
  }
}

function sanitizeFilename(name: string): string {
  const base = name.trim().split(/[/\\]/).pop() || "photo.jpg";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80);
  return cleaned || "photo.jpg";
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
