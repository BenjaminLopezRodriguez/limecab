import type { MapPoint } from "@/lib/service-app/map-adapter";
import type { Location } from "@/lib/service-app/services";

/**
 * Client fetch of the driving geometry. Falls back to a straight pair so the
 * canvas still has *a* line if Directions is down.
 */
export async function fetchDrivingRoute(
  origin: MapPoint,
  destination: MapPoint,
  signal?: AbortSignal,
): Promise<MapPoint[]> {
  const query = new URLSearchParams({
    fromLat: String(origin.latitude),
    fromLng: String(origin.longitude),
    toLat: String(destination.latitude),
    toLng: String(destination.longitude),
  });
  const res = await fetch(`/api/map/directions?${query}`, { signal });
  if (!res.ok) throw new Error("Directions failed");
  const body = (await res.json()) as { points?: MapPoint[] };
  if (!body.points?.length) throw new Error("No route");
  return body.points;
}

/** Reverse-geocode a dropped pin. Token stays on the server. */
export async function fetchReverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<Location> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  const res = await fetch(`/api/map/reverse?${query}`, { signal });
  if (!res.ok) throw new Error("Reverse geocode failed");
  const body = (await res.json()) as Location;
  if (!body.address) throw new Error("No address");
  return {
    address: body.address,
    shortName: body.shortName,
    latitude: body.latitude ?? latitude,
    longitude: body.longitude ?? longitude,
  };
}
