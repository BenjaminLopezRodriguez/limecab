import { z } from "zod";

import { env } from "@/env";
import {
  classifyPhotoFilename,
  normalizePhotoClassification,
  type AssistPhotoClassification,
} from "@/lib/limecab/assist-photo";

const CLASSIFY_MS = 8000;
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const modelSchema = z.object({
  category: z.string().optional(),
  query: z.string().optional(),
  items: z.unknown().optional(),
  labels: z.unknown().optional(),
  storeHints: z.unknown().optional(),
  stores: z.unknown().optional(),
  store: z.unknown().optional(),
});

const SYSTEM = `You classify a photo for a buy-and-deliver shopping assistant.
Identify the object. Prefer a specific product name (hex nut, 2x4, gallon of milk, pencil).
Guess the retail category and which common US chains sell it.
Hardware fasteners (nuts, bolts, screws, washers) → category "hardware", stores Home Depot and Lowe's.
Food nuts (almonds, walnuts) → grocery, not hardware.
Stationery (pencils, pens, markers, notebooks) → category "home", stores Target and Home Depot / office supply.
Reply with JSON only:
{"category":"hardware","items":[{"label":"hex nuts"}],"storeHints":["Home Depot","Lowe's"],"query":"deliver hex nuts from Home Depot now"}`;

/**
 * Classify an Assist photo. Vision via AI Gateway when authenticated
 * (`AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN`); otherwise a filename hint
 * (nut.jpg → hardware / Home Depot). Never invent a CDN.
 */
export async function classifyAssistPhoto(input: {
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
}): Promise<{
  classification: AssistPhotoClassification | null;
  source: "model" | "filename" | "none";
}> {
  const filename = input.filename.trim() || "photo.jpg";
  const fallback = classifyPhotoFilename(filename);
  const token = gatewayAuthToken();
  if (!token) {
    return fallback
      ? { classification: fallback, source: "filename" }
      : { classification: null, source: "none" };
  }

  try {
    const fromModel = await classifyWithGateway(input, filename, token);
    if (fromModel) return { classification: fromModel, source: "model" };
  } catch {
    console.info("[assist-classify] vision unavailable — filename fallback");
  }

  return fallback
    ? { classification: fallback, source: "filename" }
    : { classification: null, source: "none" };
}

/** API key first, then OIDC from `vercel env pull` / Vercel deployments. */
function gatewayAuthToken(): string | undefined {
  return env.AI_GATEWAY_API_KEY ?? env.VERCEL_OIDC_TOKEN;
}

export function readAssistPhotoPart(file: File): Promise<{
  bytes: Uint8Array;
  mediaType: string;
  filename: string;
} | null> {
  return (async () => {
    if (file.size <= 0 || file.size > MAX_BYTES) return null;
    const mediaType = file.type || mediaTypeFromName(file.name);
    if (mediaType && !ALLOWED.has(mediaType) && !mediaType.startsWith("image/")) {
      return null;
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    if (buffer.byteLength === 0) return null;
    return {
      bytes: buffer,
      mediaType: mediaType || "image/jpeg",
      filename: file.name || "photo.jpg",
    };
  })();
}

function mediaTypeFromName(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.gif$/i.test(name)) return "image/gif";
  if (/\.heic$/i.test(name)) return "image/heic";
  if (/\.heif$/i.test(name)) return "image/heif";
  return "image/jpeg";
}

async function classifyWithGateway(
  input: { bytes: Uint8Array; mediaType: string },
  filename: string,
  key: string,
): Promise<AssistPhotoClassification | null> {
  const dataUrl = `data:${input.mediaType};base64,${Buffer.from(input.bytes).toString("base64")}`;
  const res = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(CLASSIFY_MS),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Classify this photo (${filename}) for Lime Shop.`,
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    console.info(`[assist-classify] gateway ${res.status} — filename fallback`);
    return null;
  }
  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(content));
  } catch {
    return null;
  }
  const checked = modelSchema.safeParse(parsed);
  if (!checked.success) return null;
  return normalizePhotoClassification(checked.data, filename);
}

function stripFence(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  return (fenced?.[1] ?? text).trim();
}
