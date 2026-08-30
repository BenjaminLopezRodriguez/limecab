import { NextResponse } from "next/server";

import { planAssist } from "@/server/limecab/assist";

/**
 * Assist omnisearch. The model stays on the server.
 *
 * POST /api/assist  { query, lat?, lng? } → { mode, message, suggestions, cards, plan? }
 */
export async function POST(request: Request) {
  let body: { query?: unknown; lat?: unknown; lng?: unknown };
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
  });
  return NextResponse.json(result);
}
