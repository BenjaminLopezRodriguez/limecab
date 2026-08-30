import { NextResponse } from "next/server";

import { planAssist } from "@/server/limecab/assist";
import {
  ASSIST_PHOTO_CATEGORIES,
  type AssistPhotoCategory,
} from "@/lib/limecab/assist-photo";
import type { ShopItem } from "@/lib/limecab/shop-list";

/**
 * Assist omnisearch. The model stays on the server.
 *
 * POST /api/assist  { query, lat?, lng?, items?, storeHints?, category?, hasPhoto? } → { mode, message, suggestions, cards, plan? }
 */
export async function POST(request: Request) {
  let body: {
    query?: unknown;
    lat?: unknown;
    lng?: unknown;
    items?: unknown;
    storeHints?: unknown;
    category?: unknown;
    hasPhoto?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Need a query" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (query.length < 2) {
    return NextResponse.json({
      mode: "reply",
      query,
      message: "",
      suggestions: [],
      cards: [],
    });
  }

  const latitude =
    typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : 34.0505;
  const longitude =
    typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : -118.2551;

  const result = await planAssist({
    query,
    latitude,
    longitude,
    request,
    items: readItems(body.items),
    storeHints: readHints(body.storeHints),
    category: readCategory(body.category),
    hasPhoto: body.hasPhoto === true,
  });
  return NextResponse.json(result);
}

function readItems(value: unknown): ShopItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.flatMap((entry) => {
    if (typeof entry === "string" && entry.trim()) return [{ label: entry.trim() }];
    if (entry && typeof entry === "object" && "label" in entry) {
      const label = (entry as { label?: unknown }).label;
      if (typeof label !== "string" || !label.trim()) return [];
      const item: ShopItem = { label: label.trim() };
      const note = (entry as { note?: unknown }).note;
      const qty = (entry as { qty?: unknown }).qty;
      if (typeof note === "string" && note.trim()) item.note = note.trim();
      if (typeof qty === "number" && qty > 1) item.qty = qty;
      return [item];
    }
    return [];
  });
  return items.length > 0 ? items : undefined;
}

function readHints(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const hints = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  return hints.length > 0 ? hints : undefined;
}

function readCategory(value: unknown): AssistPhotoCategory | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  return (ASSIST_PHOTO_CATEGORIES as readonly string[]).includes(key)
    ? (key as AssistPhotoCategory)
    : undefined;
}
