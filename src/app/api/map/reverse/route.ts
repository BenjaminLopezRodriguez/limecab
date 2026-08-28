import { NextResponse } from "next/server";

import { mapboxFetch, mapboxToken } from "@/server/limecab/mapbox";

/**
 * Reverse geocode for a dropped pin.
 *
 * GET /api/map/reverse?lat=&lng=
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

  const endpoint = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json`,
  );
  endpoint.searchParams.set("types", "address,poi,place,locality,neighborhood");
  // No `limit`: reverse geocoding rejects it (422) unless it is paired with a
  // single `types` value, and we want several types so `pickClosestPlace` has
  // something to choose from. Mapbox already returns one feature per type.
  endpoint.searchParams.set("access_token", token);

  const res = await mapboxFetch(endpoint, request);
  if (!res.ok) {
    const status = res.status === 403 ? 403 : 502;
    const message =
      res.status === 403
        ? "Mapbox token cannot use Geocoding. Enable Geocoding on this token."
        : "Lookup failed";
    return NextResponse.json({ error: message }, { status });
  }

  const body = (await res.json()) as {
    features?: MapboxPlace[];
  };
  const feature = pickClosestPlace(body.features ?? []);
  const address = feature?.place_name?.trim();
  if (!feature || !address) {
    return NextResponse.json({
      address: "Pinned location",
      latitude,
      longitude,
    });
  }

  return NextResponse.json({
    address,
    shortName: shortNameFromPlace(feature),
    latitude,
    longitude,
  });
}

type MapboxPlace = {
  text?: string;
  address?: string;
  place_name?: string;
  place_type?: string[];
  properties?: { feature_name?: string };
};

function pickClosestPlace(features: MapboxPlace[]): MapboxPlace | undefined {
  return (
    features.find((feature) => feature.place_type?.includes("poi")) ??
    features.find((feature) => feature.place_type?.includes("address")) ??
    features[0]
  );
}

function shortNameFromPlace(feature: MapboxPlace): string {
  const text = firstNonEmpty(
    feature.text,
    feature.properties?.feature_name,
    feature.place_name?.split(",")[0],
  );
  const number = feature.address?.trim();
  if (number && !text.startsWith(number)) return `${number} ${text}`;
  return text;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "Pinned location";
}
