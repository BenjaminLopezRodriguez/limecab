import { NextResponse } from "next/server";

import { pointsFromLineString } from "@/lib/service-app/map-adapter";
import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

/**
 * Driving geometry for the ride canvas. Token stays on the server.
 *
 * GET /api/map/directions?fromLat=&fromLng=&toLat=&toLng=
 */
export async function GET(request: Request) {
  const token = mapboxToken();
  if (!token) {
    return NextResponse.json({ error: "Mapbox is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const fromLat = Number(url.searchParams.get("fromLat"));
  const fromLng = Number(url.searchParams.get("fromLng"));
  const toLat = Number(url.searchParams.get("toLat"));
  const toLng = Number(url.searchParams.get("toLng"));
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: "Need from and to coordinates" }, { status: 400 });
  }

  const path = `${fromLng},${fromLat};${toLng},${toLat}`;
  const endpoint = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${path}`,
  );
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("access_token", token);

  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) {
    const status = res.status === 403 ? 403 : 502;
    const message =
      res.status === 403
        ? "Mapbox token cannot use Directions. Enable Directions on this token."
        : "Directions failed";
    return NextResponse.json({ error: message }, { status });
  }

  const body = (await res.json()) as {
    routes?: { geometry?: { coordinates?: number[][] } }[];
  };
  const geometry = body.routes?.[0]?.geometry;
  if (!geometry?.coordinates?.length) {
    return NextResponse.json({ error: "No route" }, { status: 404 });
  }

  return NextResponse.json({
    points: pointsFromLineString({ coordinates: geometry.coordinates }),
  });
}
