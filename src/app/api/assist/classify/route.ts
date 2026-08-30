import { NextResponse } from "next/server";

import { assistQueryFromPhoto } from "@/lib/limecab/assist-photo";
import {
  classifyAssistPhoto,
  readAssistPhotoPart,
} from "@/server/limecab/assist-classify";
import { storeAssistPhotoBlob } from "@/server/limecab/assist-photo-blob";

/**
 * Upload + classify an Assist compose photo for Shop.
 *
 * POST /api/assist/classify  multipart image →
 *   { classification, source, blobUrl, preparedPrompt }
 *
 * Bytes go to the private Blob store when `BLOB_READ_WRITE_TOKEN` is set.
 * Vision runs via AI Gateway; filename fallback when vision is unkeyed/fails.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Need a photo" }, { status: 400 });
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Need a photo" }, { status: 400 });
  }

  const part = await readAssistPhotoPart(file);
  if (!part) {
    return NextResponse.json(
      { error: "Photo must be an image under 4 MB" },
      { status: 413 },
    );
  }

  const [stored, result] = await Promise.all([
    storeAssistPhotoBlob(part),
    classifyAssistPhoto(part),
  ]);

  const preparedPrompt = result.classification
    ? assistQueryFromPhoto(result.classification)
    : "";

  return NextResponse.json({
    classification: result.classification,
    source: result.source,
    blobUrl: stored?.url ?? null,
    preparedPrompt: preparedPrompt || null,
  });
}
