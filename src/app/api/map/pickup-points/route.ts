import { NextResponse } from "next/server";

import {
  pickupPointsFromVendor,
  type SearchBoxFeature,
} from "@/lib/limecab/pickup-points";
import { pointsFromLineString, type MapPoint } from "@/lib/service-app/map-adapter";
import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

/**
 * Curb-side pickup candidates for confirm-pickup.
 *
 * GET /api/map/pickup-points?lat=&lng=&q=
 *
 * Search Box routable_points are named access (entrances, driving). Map
 * Matching (or Directions, if Matching is not on the token) snaps the
 * parcel centroid onto a road. Nearby curb choices walk that road.
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

  const query = url.searchParams.get("q")?.trim() ?? "";
  const place = {
    latitude,
    longitude,
    ...(query ? { address: query } : {}),
  };

  const [features, snap] = await Promise.all([
    searchBoxFeatures(token, request, place, query),
    snapToRoad(token, request, latitude, longitude),
  ]);

  const points = pickupPointsFromVendor({
    place,
    features,
    snap: snap?.point ?? null,
    roadPath: snap?.path ?? null,
  });

  return NextResponse.json({
    points,
    selectedId: points[0]?.id ?? null,
  });
}

async function searchBoxFeatures(
  token: string,
  request: Request,
  place: { latitude: number; longitude: number },
  query: string,
): Promise<SearchBoxFeature[]> {
  const reverse = new URL("https://api.mapbox.com/search/searchbox/v1/reverse");
  reverse.searchParams.set("access_token", token);
  reverse.searchParams.set("longitude", String(place.longitude));
  reverse.searchParams.set("latitude", String(place.latitude));
  reverse.searchParams.set("language", "en");
  reverse.searchParams.set("limit", "5");

  const lookups: Promise<SearchBoxFeature[]>[] = [
    searchBoxCollection(reverse, request),
  ];

  if (query.length >= 3) {
    const forward = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
    forward.searchParams.set("access_token", token);
    forward.searchParams.set("q", query.slice(0, 256));
    forward.searchParams.set("language", "en");
    forward.searchParams.set("limit", "5");
    forward.searchParams.set("proximity", `${place.longitude},${place.latitude}`);
    forward.searchParams.set("country", "US");
    lookups.push(searchBoxCollection(forward, request));
  }

  const batches = await Promise.all(lookups);
  return batches.flat();
}

async function searchBoxCollection(
  endpoint: URL,
  request: Request,
): Promise<SearchBoxFeature[]> {
  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) return [];
  const body = (await res.json()) as { features?: SearchBoxFeature[] };
  return body.features ?? [];
}

async function snapToRoad(
  token: string,
  request: Request,
  latitude: number,
  longitude: number,
): Promise<{ point: MapPoint; path: MapPoint[] } | null> {
  const [matched, directed] = await Promise.all([
    mapMatch(token, request, latitude, longitude),
    directionsSnap(token, request, latitude, longitude),
  ]);
  const point = matched?.point ?? directed?.point ?? null;
  const matchedPath = usableRoadPath(matched?.path);
  const directedPath = usableRoadPath(directed?.path);
  const path = matchedPath ?? directedPath ?? [];
  if (!point) return null;
  return { point, path };
}

function usableRoadPath(path: MapPoint[] | undefined): MapPoint[] | null {
  if (!path || path.length < 2) return null;
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const dLat = (next.latitude - prev.latitude) * 111_320;
    const dLng =
      (next.longitude - prev.longitude) *
      111_320 *
      Math.cos((prev.latitude * Math.PI) / 180);
    length += Math.hypot(dLat, dLng);
  }
  return length >= 30 ? path : null;
}

async function mapMatch(
  token: string,
  request: Request,
  latitude: number,
  longitude: number,
): Promise<{ point: MapPoint; path: MapPoint[] } | null> {
  const pair = `${longitude},${latitude};${longitude},${latitude}`;
  const endpoint = new URL(
    `https://api.mapbox.com/matching/v5/mapbox/driving/${pair}`,
  );
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("radiuses", "50;50");
  endpoint.searchParams.set("access_token", token);

  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    matchings?: { geometry?: { coordinates?: number[][] } }[];
    tracepoints?: ({ location?: number[] } | null)[];
  };
  const snapped = body.tracepoints?.find((point) => point?.location);
  const lng = snapped?.location?.[0];
  const lat = snapped?.location?.[1];
  const path = body.matchings?.[0]?.geometry?.coordinates
    ? pointsFromLineString({
        coordinates: body.matchings[0].geometry.coordinates,
      })
    : [];
  if (typeof lng !== "number" || typeof lat !== "number") {
    const first = path[0];
    return first ? { point: first, path } : null;
  }
  return { point: { latitude: lat, longitude: lng }, path };
}

/**
 * Map Matching is a separate token scope. Directions is already required for
 * the ride canvas — a short hop still snaps the start onto a driving road.
 */
async function directionsSnap(
  token: string,
  request: Request,
  latitude: number,
  longitude: number,
): Promise<{ point: MapPoint; path: MapPoint[] } | null> {
  const north = latitude + 180 / 111_320;
  const path = `${longitude},${latitude};${longitude},${north}`;
  const endpoint = new URL(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${path}`,
  );
  endpoint.searchParams.set("geometries", "geojson");
  endpoint.searchParams.set("overview", "full");
  endpoint.searchParams.set("access_token", token);

  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) return null;
  const body = (await res.json()) as {
    waypoints?: { location?: number[] }[];
    routes?: { geometry?: { coordinates?: number[][] } }[];
  };
  const snapped = body.waypoints?.[0]?.location;
  const geometry = body.routes?.[0]?.geometry;
  const road = geometry?.coordinates?.length
    ? pointsFromLineString({ coordinates: geometry.coordinates })
    : [];
  if (snapped && snapped.length >= 2) {
    const [lng, lat] = snapped;
    if (typeof lng === "number" && typeof lat === "number") {
      return { point: { latitude: lat, longitude: lng }, path: road };
    }
  }
  const first = road[0];
  return first ? { point: first, path: road } : null;
}
