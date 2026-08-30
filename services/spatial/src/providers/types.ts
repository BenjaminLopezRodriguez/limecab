import type { ProviderName } from "../contract.ts";

/**
 * What the domain is allowed to see. Provider-neutral on purpose: nothing
 * Google-shaped, nothing Mapbox-shaped, and nothing the GMP terms forbid us
 * from storing — no photos, ratings, reviews, hours or phone numbers, because
 * the adapters never ask for them.
 */
export type ProviderPlace = {
  providerPlaceId: string;
  name: string;
  latitude: number;
  longitude: number;
  rawTypes: string[];
  address?: string | null;
  sourceUpdatedAt?: string | null;
};

export type NearbyRequest = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  entityTypes?: string[];
  maxResults?: number;
};

export type TextRequest = {
  query: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  maxResults?: number;
};

export interface PlacesProvider {
  readonly name: ProviderName;
  searchNearby(req: NearbyRequest): Promise<ProviderPlace[]>;
  searchText(req: TextRequest): Promise<ProviderPlace[]>;
  resolvePlace(providerPlaceId: string): Promise<ProviderPlace | null>;
}
