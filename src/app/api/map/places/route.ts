import { NextResponse } from "next/server";

import type { LocationSuggestion } from "@/lib/service-app/geocode-adapter";
import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

/**
 * Mapbox Places (Geocoding v5) for destination search.
 *
 * GET /api/map/places?q=           → { suggestions }
 * GET /api/map/places?id=          → Location
 * GET /api/map/places?lat=&lng=    → Location (reverse)
 */
export async function GET(request: Request) {
  const token = mapboxToken();
  if (!token) {
    return NextResponse.json({ error: "Mapbox is not configured" }, { status: 503 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id) {
    const location = locationFromPlaceId(id);
    if (!location) {
      return NextResponse.json({ error: "Unknown place" }, { status: 404 });
    }
    return NextResponse.json(location);
  }

  const latitude = Number(url.searchParams.get("lat"));
  const longitude = Number(url.searchParams.get("lng"));
  if (Number.isFinite(latitude) && Number.isFinite(longitude) && !url.searchParams.get("q")) {
    return reverse(token, request, latitude, longitude);
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const proximityLat = Number.isFinite(latitude) ? latitude : 34.0505;
  const proximityLng = Number.isFinite(longitude) ? longitude : -118.2551;

  const endpoint = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("autocomplete", "true");
  endpoint.searchParams.set("limit", "6");
  endpoint.searchParams.set("types", "address,poi,place,locality,neighborhood");
  endpoint.searchParams.set("proximity", `${proximityLng},${proximityLat}`);
  endpoint.searchParams.set("country", "US");

  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) {
    const status = res.status === 403 ? 403 : 502;
    const message =
      res.status === 403
        ? "Mapbox token cannot use Geocoding. Enable Geocoding (Places) on this token."
        : "Lookup failed";
    return NextResponse.json({ error: message }, { status });
  }

  const body = (await res.json()) as { features?: MapboxFeature[] };
  return NextResponse.json({
    suggestions: suggestionsFromPlaces(body.features ?? []),
  });
}

type MapboxFeature = {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
};

function firstText(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function suggestionsFromPlaces(
  features: MapboxFeature[],
): LocationSuggestion[] {
  return features.flatMap((feature) => {
    const id = placeIdFromFeature(feature);
    const address = firstText(feature.place_name, feature.text);
    if (!id || !address) return [];
    const context = address.includes(",")
      ? address.slice(address.indexOf(",") + 1).trim()
      : undefined;
    return [{ id, address, context }];
  });
}

function placeIdFromFeature(feature: MapboxFeature): string | null {
  const center = feature.center;
  const name = firstText(feature.place_name, feature.text);
  if (!center || center.length < 2 || !name) return null;
  const [lng, lat] = center;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return `mb:${lng.toFixed(6)},${lat.toFixed(6)}::${name}`;
}

function locationFromPlaceId(id: string): {
  address: string;
  latitude: number;
  longitude: number;
} | null {
  if (!id.startsWith("mb:")) return null;
  const payload = id.slice(3);
  const split = payload.indexOf("::");
  if (split < 0) return null;
  const [lngRaw, latRaw] = payload.slice(0, split).split(",");
  const longitude = Number(lngRaw);
  const latitude = Number(latRaw);
  const address = payload.slice(split + 2).trim();
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address) {
    return null;
  }
  return { address, latitude, longitude };
}

async function reverse(
  token: string,
  request: Request,
  latitude: number,
  longitude: number,
) {
  const endpoint = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
  );
  endpoint.searchParams.set("types", "address,poi,place,locality,neighborhood");
  // Same 422 as /api/map/reverse: `limit` is only legal on a reverse lookup
  // when a single `types` value is given. Without it Mapbox returns the
  // closest feature first, which is what this reads anyway.
  endpoint.searchParams.set("access_token", token);
  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) {
    return NextResponse.json({
      address: "Pinned location",
      latitude,
      longitude,
    });
  }
  const body = (await res.json()) as { features?: MapboxFeature[] };
  const feature = body.features?.[0];
  return NextResponse.json({
    address: firstText(feature?.place_name) ?? "Pinned location",
    latitude,
    longitude,
  });
}
