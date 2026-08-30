import type { PickupCandidate } from "@/lib/limecab/pickup-points";
import {
  createHttpGeocodeAdapter,
  type GeocodeAdapter,
} from "@/lib/service-app/geocode-adapter";
import {
  CURRENT_LOCATION,
  HARDWARE_PLACES,
  REST_STOPS,
  SHOP_PLACES,
  geocodeAdapter as staticGeocodeAdapter,
} from "@/lib/limecab/mock";
import {
  HARDWARE_CATEGORIES,
  nearbyRestStops,
  SHOP_CATEGORIES,
  type RestStop,
} from "@/lib/limecab/rest-stops";
import type { Location } from "@/lib/service-app/services";

/**
 * Where to bias address search. The rider's pickup or device fix when there is
 * one; downtown LA as the last-ditch default, because a geocoder with no
 * proximity at all ranks a Springfield in every state above the one next door.
 *
 * Module-scoped because the adapter is a singleton and the bias is not a
 * question any scene asks — it is ambient, and prop-drilling it through the
 * ride flow would put a geocoder detail in five component signatures.
 */
let proximity = {
  latitude: CURRENT_LOCATION.latitude!,
  longitude: CURRENT_LOCATION.longitude!,
};

export function setSearchProximity(
  point: { latitude?: number; longitude?: number } | null,
) {
  if (point?.latitude === undefined || point.longitude === undefined) return;
  proximity = { latitude: point.latitude, longitude: point.longitude };
}

/**
 * Address search: the NL place pipeline when a vendor token is configured,
 * static LA fixtures otherwise.
 *
 * The fixtures used to be *prepended* to every live result, which is why "gr"
 * always led with Griffith no matter what the geocoder said. They are the
 * fallback now — the answer when Mapbox is down or unconfigured, never a
 * queue-jump ahead of it.
 */
export function createPlacesAdapter(): GeocodeAdapter {
  const http = createHttpGeocodeAdapter("/api/map/places");

  return {
    async suggest(query, signal) {
      try {
        const res = await fetch(
          `/api/map/places?q=${encodeURIComponent(query)}&lat=${proximity.latitude}&lng=${proximity.longitude}`,
          { signal },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            suggestions?: Awaited<ReturnType<GeocodeAdapter["suggest"]>>;
          };
          return (body.suggestions ?? []).slice(0, 8);
        }
      } catch {
        /* Mapbox down or unconfigured — static list still answers. */
      }
      return staticGeocodeAdapter.suggest(query, signal);
    },
    async retrieve(id) {
      try {
        return await http.retrieve(id);
      } catch {
        return staticGeocodeAdapter.retrieve(id);
      }
    },
    async reverse(latitude, longitude) {
      try {
        return (
          (await http.reverse?.(latitude, longitude)) ?? {
            address: "Current location",
            latitude,
            longitude,
          }
        );
      } catch {
        return (
          (await staticGeocodeAdapter.reverse?.(latitude, longitude)) ?? {
            address: "Current location",
            latitude,
            longitude,
          }
        );
      }
    },
  };
}

/**
 * Category Search around a point, with a fixture list behind it: Mapbox being
 * down must leave the scene with rows, not a blank.
 *
 * One lookup for every category — a second endpoint would be a second story
 * about the same Search Box response.
 */
async function fetchNearbyCategory(
  origin: Location,
  categories: readonly string[] | undefined,
  fallback: readonly RestStop[],
  signal?: AbortSignal,
): Promise<RestStop[]> {
  if (origin.latitude === undefined || origin.longitude === undefined) {
    return nearbyRestStops(origin, fallback);
  }
  try {
    const query = categories?.length
      ? `&categories=${categories.join(",")}`
      : "";
    const res = await fetch(
      `/api/map/category?lat=${origin.latitude}&lng=${origin.longitude}${query}`,
      { signal },
    );
    if (res.ok) {
      const body = (await res.json()) as { stops?: RestStop[] };
      if (body.stops && body.stops.length > 0) return body.stops;
    }
  } catch {
    /* Mapbox down or unconfigured — fixtures still answer. */
  }
  return nearbyRestStops(origin, fallback);
}

/** Curb-side pickup candidates for confirm-pickup. Token stays on the server. */
export async function fetchPickupPoints(
  latitude: number,
  longitude: number,
  address?: string,
  signal?: AbortSignal,
): Promise<{ points: PickupCandidate[]; selectedId: string | null }> {
  const query = new URLSearchParams({
    lat: String(latitude),
    lng: String(longitude),
  });
  if (address) query.set("q", address);
  const res = await fetch(`/api/map/pickup-points?${query}`, { signal });
  if (!res.ok) throw new Error("Pickup points failed");
  const body = (await res.json()) as {
    points?: PickupCandidate[];
    selectedId?: string | null;
  };
  const points = body.points ?? [];
  if (points.length === 0) throw new Error("No pickup points");
  return {
    points,
    selectedId: body.selectedId ?? points[0]?.id ?? null,
  };
}

/** Coffee and highway rest areas around a heading pin. */
export async function fetchNearbyRestStops(
  origin: Location,
  signal?: AbortSignal,
): Promise<RestStop[]> {
  return fetchNearbyCategory(origin, undefined, REST_STOPS, signal);
}

/** Grocery, supermarket and pharmacy around the rider — Lime Shop's stores. */
export async function fetchNearbyShops(
  origin: Location,
  signal?: AbortSignal,
  opts?: { hardware?: boolean },
): Promise<RestStop[]> {
  if (opts?.hardware) {
    return fetchNearbyCategory(origin, HARDWARE_CATEGORIES, HARDWARE_PLACES, signal);
  }
  return fetchNearbyCategory(origin, SHOP_CATEGORIES, SHOP_PLACES, signal);
}
