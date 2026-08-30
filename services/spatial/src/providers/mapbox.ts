import type { ProviderName } from "../contract.ts";
import type {
  NearbyRequest,
  PlacesProvider,
  ProviderPlace,
  TextRequest,
} from "./types.ts";

const BASE = "https://api.mapbox.com/search/searchbox/v1";
const TIMEOUT_MS = 2800;

type SearchBoxFeature = {
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    coordinates?: { latitude?: number; longitude?: number };
    poi_category?: string[];
    feature_type?: string;
  };
  geometry?: { coordinates?: [number, number] };
};

/**
 * Mapbox is in the loop deliberately: when Google declines or our coverage is
 * thin, Mapbox results still warm the same tables instead of evaporating.
 * Coverage rows are per-provider, so "Mapbox covered this cell" never claims
 * Google did.
 */
export class MapboxProvider implements PlacesProvider {
  readonly name: ProviderName = "mapbox";
  readonly #token: string | undefined;

  constructor(token = process.env.MAPBOX_TOKEN) {
    this.#token = token;
  }

  async searchNearby(req: NearbyRequest): Promise<ProviderPlace[]> {
    const url = new URL(`${BASE}/category/${categoryFor(req.entityTypes)}`);
    url.searchParams.set("proximity", `${req.longitude},${req.latitude}`);
    url.searchParams.set("limit", String(Math.min(25, req.maxResults ?? 25)));
    url.searchParams.set("language", "en");
    url.searchParams.set("country", "US");
    return this.#features(url, "category");
  }

  async searchText(req: TextRequest): Promise<ProviderPlace[]> {
    const url = new URL(`${BASE}/forward`);
    url.searchParams.set("q", req.query.slice(0, 256));
    url.searchParams.set("limit", String(Math.min(10, req.maxResults ?? 10)));
    url.searchParams.set("language", "en");
    url.searchParams.set("country", "US");
    if (typeof req.latitude === "number" && typeof req.longitude === "number") {
      url.searchParams.set("proximity", `${req.longitude},${req.latitude}`);
    }
    return this.#features(url, "forward");
  }

  async resolvePlace(providerPlaceId: string): Promise<ProviderPlace | null> {
    if (!this.#token) return null;
    const url = new URL(`${BASE}/retrieve/${encodeURIComponent(providerPlaceId)}`);
    url.searchParams.set("session_token", "spatial-index");
    const features = await this.#features(url, "retrieve");
    return features[0] ?? null;
  }

  async #features(url: URL, label: string): Promise<ProviderPlace[]> {
    if (!this.#token) return [];
    url.searchParams.set("access_token", this.#token);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        console.info(`[spatial] mapbox ${label} ${res.status}`);
        return [];
      }
      const body = (await res.json()) as { features?: SearchBoxFeature[] };
      return (body.features ?? []).flatMap((feature) => {
        const mapped = toProviderPlace(feature);
        return mapped ? [mapped] : [];
      });
    } catch {
      console.info(`[spatial] mapbox ${label} unavailable`);
      return [];
    }
  }
}

/** Mapbox category search needs one category; "shop" is its widest net. */
function categoryFor(entityTypes: string[] | undefined): string {
  const first = entityTypes?.[0];
  if (!first) return "shop";
  const map: Record<string, string> = {
    grocery_store: "grocery",
    convenience_store: "convenience_store",
    pharmacy: "pharmacy",
    restaurant: "restaurant",
    cafe: "coffee",
    gas_station: "gas_station",
    parking: "parking_lot",
    hotel: "hotel",
    hospital: "hospital",
    park: "park",
    retail_store: "shop",
  };
  return map[first] ?? "shop";
}

function toProviderPlace(feature: SearchBoxFeature): ProviderPlace | null {
  const props = feature.properties;
  const id = props?.mapbox_id;
  const name = props?.name?.trim();
  const latitude = props?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];
  const longitude = props?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
  if (!id || !name || typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  return {
    providerPlaceId: id,
    name,
    latitude,
    longitude,
    rawTypes: props?.poi_category ?? (props?.feature_type ? [props.feature_type] : []),
    address: props?.full_address?.trim() ?? props?.place_formatted?.trim() ?? null,
  };
}
