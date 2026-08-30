import { NextResponse } from "next/server";

import { nearbyQuerySchema } from "@/lib/limecab/spatial";
import { findNearby } from "@/server/limecab/spatial";

/**
 * The spatial index, over HTTP.
 *
 * GET /api/map/nearby?lat=&lng=&brand=&types=grocery_store,pharmacy&q=&limit=&maxMeters=
 *
 * An unconfigured or cold index answers 200 with `degraded` — callers have a
 * Mapbox path behind this one, and 503 would make them treat it as a failure.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = nearbyQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Bad query" },
      { status: 400 },
    );
  }

  const places = await findNearby(parsed.data);
  if (places === null) {
    return NextResponse.json({ places: [], degraded: true });
  }
  return NextResponse.json({ places });
}
