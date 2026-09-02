import type { PlaceSearchAdapter, PlaceSuggestion } from "../adapters/places.ts";
import { RECENT_PLACES, SAVED_PLACES } from "./rider.ts";

/**
 * A deterministic stand-in for the geocoder.
 *
 * It substitutes for the server, never for the interaction: the same shapes come back, in the
 * same order, with the same saved-and-recent resting state, so the scene above it behaves
 * exactly as it will once a real adapter is wired in.
 */

const CATALOGUE: PlaceSuggestion[] = [
  ...SAVED_PLACES.map((place) => ({
    id: place.id,
    address: place.label,
    context: place.address,
    source: "saved" as const,
  })),
  ...RECENT_PLACES.map((place) => ({
    id: place.id,
    address: place.label,
    context: place.address,
    source: "recent" as const,
  })),
  { id: "ont", address: "Ontario, CA", context: "San Bernardino County", latitude: 34.06, longitude: -117.6, source: "search" },
  { id: "ont-airport", address: "Ontario International Airport", context: "ONT · Terminal 2", latitude: 34.056, longitude: -117.601, source: "search" },
  { id: "ont-mills", address: "Ontario Mills", context: "1 Mills Cir", latitude: 34.07, longitude: -117.55, source: "search" },
  { id: "dtla", address: "Downtown Los Angeles", context: "Los Angeles, CA", latitude: 34.05, longitude: -118.25, source: "search" },
  { id: "hope", address: "400 S Hope St", context: "Los Angeles, CA", latitude: 34.051, longitude: -118.254, source: "search" },
  { id: "union", address: "Union Station", context: "800 N Alameda St", latitude: 34.056, longitude: -118.236, source: "search" },
];

export const fixturePlaceSearch: PlaceSearchAdapter = {
  async search(query: string): Promise<PlaceSuggestion[]> {
    const q = query.trim().toLowerCase();
    // No query is the resting state, not an empty one: saved and recent places, as production.
    if (!q) return CATALOGUE.filter((place) => place.source !== "search");
    return CATALOGUE.filter(
      (place) =>
        place.address.toLowerCase().includes(q) || (place.context ?? "").toLowerCase().includes(q),
    );
  },
};
