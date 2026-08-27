import {
  createHttpGeocodeAdapter,
  type GeocodeAdapter,
} from "@/lib/service-app/geocode-adapter";
import {
  CURRENT_LOCATION,
  geocodeAdapter as staticGeocodeAdapter,
} from "@/lib/limecab/mock";

/**
 * Address search: Mapbox Places when the token is configured, static LA
 * fixtures otherwise. Failures fall back so typing never dead-ends.
 */
export function createPlacesAdapter(): GeocodeAdapter {
  const http = createHttpGeocodeAdapter("/api/map/places");
  const proximity = `lat=${CURRENT_LOCATION.latitude}&lng=${CURRENT_LOCATION.longitude}`;

  return {
    async suggest(query, signal) {
      try {
        const res = await fetch(
          `/api/map/places?q=${encodeURIComponent(query)}&${proximity}`,
          { signal },
        );
        if (res.ok) {
          const body = (await res.json()) as {
            suggestions?: Awaited<ReturnType<GeocodeAdapter["suggest"]>>;
          };
          if (body.suggestions?.length) return body.suggestions;
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
