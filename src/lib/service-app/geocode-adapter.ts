import type { Location } from "@/lib/service-app/services";

/**
 * Geocoding seam.
 *
 * The kit ships no geocoding vendor. `LocationSearch` talks to whatever
 * adapter it is given. Point `suggest`/`retrieve` at your own route handler
 * so the provider token stays server-side.
 */

export type LocationSuggestion = {
  id: string;
  address: string;
  /** Secondary line, e.g. "San Francisco, CA". */
  context?: string;
};

export interface GeocodeAdapter {
  suggest(query: string, signal?: AbortSignal): Promise<LocationSuggestion[]>;
  /** Resolves a suggestion to coordinates. */
  retrieve(id: string): Promise<Location>;
  /** Optional reverse lookup for "use my current location". */
  reverse?(latitude: number, longitude: number): Promise<Location>;
}

/**
 * Offline adapter over a fixed list. Useful for the demo route, for tests,
 * and as the fallback before a provider is wired up.
 */
export function createStaticGeocodeAdapter(
  entries: ReadonlyArray<{
    id: string;
    address: string;
    context?: string;
    latitude?: number;
    longitude?: number;
  }>,
): GeocodeAdapter {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  return {
    async suggest(query) {
      const needle = query.trim().toLowerCase();
      if (needle.length < 2) return [];
      return entries
        .filter(
          (entry) =>
            entry.address.toLowerCase().includes(needle) ||
            entry.context?.toLowerCase().includes(needle),
        )
        .slice(0, 6)
        .map(({ id, address, context }) => ({ id, address, context }));
    },
    async retrieve(id) {
      const entry = byId.get(id);
      if (!entry) throw new Error("Unknown place");
      return {
        address: entry.address,
        latitude: entry.latitude,
        longitude: entry.longitude,
      };
    },
    async reverse(latitude, longitude) {
      return { address: "Current location", latitude, longitude };
    },
  };
}

/**
 * Adapter over your own API routes. Expects:
 *   GET {basePath}?q=…   -> { suggestions: LocationSuggestion[] }
 *   GET {basePath}?id=…  -> Location
 *   GET {basePath}?lat=…&lng=… -> Location
 */
export function createHttpGeocodeAdapter(basePath: string): GeocodeAdapter {
  const get = async <T,>(query: string, signal?: AbortSignal): Promise<T> => {
    const res = await fetch(`${basePath}?${query}`, { signal });
    if (!res.ok) throw new Error("Lookup failed");
    return (await res.json()) as T;
  };

  return {
    async suggest(query, signal) {
      const data = await get<{ suggestions?: LocationSuggestion[] }>(
        `q=${encodeURIComponent(query)}`,
        signal,
      );
      return data.suggestions ?? [];
    },
    retrieve: (id) => get<Location>(`id=${encodeURIComponent(id)}`),
    reverse: (latitude, longitude) =>
      get<Location>(`lat=${latitude}&lng=${longitude}`),
  };
}
