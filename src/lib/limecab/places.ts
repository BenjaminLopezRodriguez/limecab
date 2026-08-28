import {
  createHttpGeocodeAdapter,
  type GeocodeAdapter,
  type LocationSuggestion,
} from "@/lib/service-app/geocode-adapter";
import {
  CURRENT_LOCATION,
  REST_STOPS,
  geocodeAdapter as staticGeocodeAdapter,
} from "@/lib/limecab/mock";
import { nearbyRestStops } from "@/lib/limecab/rest-stops";
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
 * Address search: Mapbox Places when the token is configured, static LA
 * fixtures otherwise.
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

const REST_STOP_QUERIES = ["coffee", "rest area"] as const;
const REST_STOP_LIMIT = 8;

function locationFromSuggestion(
  suggestion: LocationSuggestion,
): Location | null {
  const id = suggestion.id;
  if (!id.startsWith("mb:")) return null;
  const payload = id.slice(3);
  const split = payload.indexOf("::");
  if (split < 0) return null;
  const [lngRaw, latRaw] = payload.slice(0, split).split(",");
  const longitude = Number(lngRaw);
  const latitude = Number(latRaw);
  const address = payload.slice(split + 2).trim() || suggestion.address;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !address) {
    return null;
  }
  return {
    address,
    shortName: suggestion.address.split(",")[0]?.trim() || address,
    latitude,
    longitude,
  };
}

/**
 * Coffee and highway rest areas around a heading pin. Mapbox first; the
 * fixture list if the token cannot geocode.
 */
export async function fetchNearbyRestStops(
  origin: Location,
  signal?: AbortSignal,
): Promise<Location[]> {
  if (origin.latitude === undefined || origin.longitude === undefined) {
    return nearbyRestStops(origin, REST_STOPS);
  }
  const found: Location[] = [];
  const seen = new Set<string>();
  try {
    await Promise.all(
      REST_STOP_QUERIES.map(async (query) => {
        const res = await fetch(
          `/api/map/places?q=${encodeURIComponent(query)}&lat=${origin.latitude}&lng=${origin.longitude}`,
          { signal },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { suggestions?: LocationSuggestion[] };
        for (const suggestion of body.suggestions ?? []) {
          const place = locationFromSuggestion(suggestion);
          if (!place) continue;
          const key = `${place.latitude?.toFixed(4)},${place.longitude?.toFixed(4)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          found.push(place);
        }
      }),
    );
  } catch {
    /* Mapbox down or unconfigured — fixtures still answer. */
  }
  if (found.length > 0) return found.slice(0, REST_STOP_LIMIT);
  return nearbyRestStops(origin, REST_STOPS);
}
