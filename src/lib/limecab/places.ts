import {
  createHttpGeocodeAdapter,
  type GeocodeAdapter,
} from "@/lib/service-app/geocode-adapter";
import {
  CURRENT_LOCATION,
  geocodeAdapter as staticGeocodeAdapter,
} from "@/lib/limecab/mock";

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
