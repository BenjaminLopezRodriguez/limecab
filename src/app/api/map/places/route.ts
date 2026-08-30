import { NextResponse } from "next/server";

import { env } from "@/env";
import { searchNaturalPlaces } from "@/server/limecab/place-search";
import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

/**
 * Place search for the rider sheet.
 *
 * GET /api/map/places?q=           → { suggestions }
 * GET /api/map/places?id=          → Location
 * GET /api/map/places?lat=&lng=    → Location (reverse)
 *
 * `q` runs NL intent → Mapbox Places/Search Box + Google Places → rank.
 */
export async function GET(request: Request) {
  const token = mapboxToken();
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
    if (!token) {
      return NextResponse.json({ error: "Mapbox is not configured" }, { status: 503 });
    }
    return reverse(token, request, latitude, longitude);
  }

  const query = url.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!token && !env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json({ error: "Mapbox is not configured" }, { status: 503 });
  }

  const proximityLat = Number.isFinite(latitude) ? latitude : undefined;
  const proximityLng = Number.isFinite(longitude) ? longitude : undefined;

  const suggestions = await searchNaturalPlaces({
    query,
    latitude: proximityLat,
    longitude: proximityLng,
    request,
  });
  return NextResponse.json({ suggestions });
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
