import { NextResponse } from "next/server";

import { MAP_CATEGORIES, restStopsFromFeatures } from "@/lib/limecab/rest-stops";
import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

const DEFAULT_CATEGORIES = ["coffee", "rest_area"] as const;
/** Every category the app is allowed to ask for. Rest stops, then shops. */
const ALLOWED = new Set<string>(MAP_CATEGORIES);

/**
 * Mapbox Search Box Category Search.
 *
 * GET /api/map/category?lat=&lng=&categories=grocery,supermarket&limit=8
 */
export async function GET(request: Request) {
  const token = mapboxToken();
  if (!token) {
    return NextResponse.json({ error: "Mapbox is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "Need lat and lng" }, { status: 400 });
  }

  const parsedLimit = Number(url.searchParams.get("limit") ?? 8);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(25, Math.max(1, Math.trunc(parsedLimit)))
    : 8;

  const requested = (url.searchParams.get("categories") ?? DEFAULT_CATEGORIES.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter((value) => ALLOWED.has(value));
  const categories = requested.length > 0 ? requested : [...DEFAULT_CATEGORIES];

  const results = await Promise.all(
    categories.map(async (category) => {
      const endpoint = new URL(
        `https://api.mapbox.com/search/searchbox/v1/category/${encodeURIComponent(category)}`,
      );
      endpoint.searchParams.set("access_token", token);
      endpoint.searchParams.set("language", "en");
      endpoint.searchParams.set("limit", String(limit));
      endpoint.searchParams.set("proximity", `${longitude},${latitude}`);
      endpoint.searchParams.set("country", "US");

      const res = await mapboxFetch(endpoint, request);
      if (res.status === 403) return { status: 403 as const };
      if (!res.ok) return { status: 502 as const };
      const body = (await res.json()) as { features?: unknown[] };
      return {
        status: 200 as const,
        features: (body.features ?? []).map((feature) => ({
          ...(typeof feature === "object" && feature !== null ? feature : {}),
          category,
        })),
      };
    }),
  );

  if (results.some((result) => result.status === 403)) {
    return NextResponse.json(
      {
        error:
          "Mapbox token cannot use Search Box. Enable Search Box API on this token.",
      },
      { status: 403 },
    );
  }

  const features = results.flatMap((result) =>
    result.status === 200 ? result.features : [],
  );
  if (features.length === 0 && results.every((result) => result.status !== 200)) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
  }

  return NextResponse.json({
    stops: restStopsFromFeatures(
      { features },
      { latitude, longitude },
      limit,
    ),
  });
}
