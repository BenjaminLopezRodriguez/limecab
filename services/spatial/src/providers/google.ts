import type { ProviderName } from "../contract.ts";
import type {
  NearbyRequest,
  PlacesProvider,
  ProviderPlace,
  TextRequest,
} from "./types.ts";

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 2800;

/**
 * The field mask is the storage policy. Photos, reviews, ratings, opening
 * hours, phone numbers and editorial summaries are not merely unstored — they
 * are never requested, so there is nothing to leak into the tables.
 */
const NEARBY_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types";
const PLACE_MASK = "id,displayName,formattedAddress,location,types";

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

export class GooglePlacesProvider implements PlacesProvider {
  readonly name: ProviderName = "google";
  readonly #key: string | undefined;

  constructor(key = process.env.GOOGLE_PLACES_API_KEY) {
    this.#key = key;
  }

  async searchNearby(req: NearbyRequest): Promise<ProviderPlace[]> {
    return this.#post("places:searchNearby", NEARBY_MASK, {
      maxResultCount: Math.min(20, req.maxResults ?? 20),
      languageCode: "en",
      ...(req.entityTypes?.length ? { includedTypes: req.entityTypes } : {}),
      locationRestriction: {
        circle: {
          center: { latitude: req.latitude, longitude: req.longitude },
          radius: req.radiusMeters,
        },
      },
    });
  }

  async searchText(req: TextRequest): Promise<ProviderPlace[]> {
    const origin =
      typeof req.latitude === "number" && typeof req.longitude === "number"
        ? { latitude: req.latitude, longitude: req.longitude }
        : null;
    return this.#post("places:searchText", NEARBY_MASK, {
      textQuery: req.query,
      languageCode: "en",
      regionCode: "US",
      pageSize: Math.min(20, req.maxResults ?? 10),
      ...(origin
        ? {
            rankPreference: "DISTANCE",
            locationBias: {
              circle: {
                center: origin,
                radius: req.radiusMeters ?? 5000,
              },
            },
          }
        : {}),
    });
  }

  async resolvePlace(providerPlaceId: string): Promise<ProviderPlace | null> {
    if (!this.#key) return null;
    try {
      const res = await fetch(`${BASE}/places/${encodeURIComponent(providerPlaceId)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "X-Goog-Api-Key": this.#key,
          "X-Goog-FieldMask": PLACE_MASK,
        },
      });
      if (!res.ok) {
        console.info(`[spatial] google places ${res.status}`);
        return null;
      }
      return toProviderPlace((await res.json()) as GooglePlace);
    } catch {
      console.info("[spatial] google places unavailable");
      return null;
    }
  }

  /** A provider failure degrades to nothing found; it never throws outward. */
  async #post(
    path: string,
    mask: string,
    body: unknown,
  ): Promise<ProviderPlace[]> {
    if (!this.#key) return [];
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: "POST",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.#key,
          "X-Goog-FieldMask": mask,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.info(`[spatial] google ${path} ${res.status}`);
        return [];
      }
      const parsed = (await res.json()) as { places?: GooglePlace[] };
      return (parsed.places ?? []).flatMap((place) => {
        const mapped = toProviderPlace(place);
        return mapped ? [mapped] : [];
      });
    } catch {
      console.info(`[spatial] google ${path} unavailable`);
      return [];
    }
  }
}

function toProviderPlace(place: GooglePlace): ProviderPlace | null {
  const id = place.id;
  const name = place.displayName?.text?.trim();
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!id || !name || typeof latitude !== "number" || typeof longitude !== "number") {
    return null;
  }
  return {
    providerPlaceId: id,
    name,
    latitude,
    longitude,
    rawTypes: place.types ?? [],
    address: place.formattedAddress?.trim() ?? null,
  };
}
