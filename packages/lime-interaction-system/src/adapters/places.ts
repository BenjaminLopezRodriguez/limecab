/**
 * The place-search port.
 *
 * Production searches a geocoder. The native client reproduces the *interaction* — opening the
 * scene, typing, the result list, selecting, the transition back into the flow — while the data
 * behind it comes from wherever this port is wired. Swapping a fixture implementation for a
 * real geocoding client must not change a scene, a surface composition, or a contract.
 *
 * The shape is deliberately the least a search UI needs: an id to key on, a line to read, and a
 * coordinate to put on the map. Ranking, coverage and intent classification are the server's
 * concerns and stay out of the port.
 */

export interface PlaceSuggestion {
  id: string;
  /** The line the user reads and selects. */
  address: string;
  /** Secondary line — a neighbourhood, a city, a distance. */
  context?: string;
  latitude?: number;
  longitude?: number;
  /** Where this came from, so a scene can group saved and recent places separately. */
  source?: "saved" | "recent" | "search";
}

export interface PlaceSearchAdapter {
  /**
   * An empty query is not an empty result: production shows saved and recent places before a
   * single character is typed, and that is the scene's resting state.
   */
  search(query: string): Promise<PlaceSuggestion[]>;
}
