import "server-only";

import { env } from "@/env";
import {
  fetchNearby,
  type FindNearbyRequest,
  type LimePlace,
} from "@/lib/limecab/spatial";

/**
 * The spatial index, asked politely. Returns `null` for every way this can go
 * wrong — unset, down, slow, off-contract — because the Mapbox path behind it
 * still answers, and a cold index is not a reason to fail a rider's list.
 */
export async function findNearby(
  request: FindNearbyRequest,
): Promise<LimePlace[] | null> {
  const baseUrl = env.SPATIAL_API_URL;
  const apiKey = env.SPATIAL_API_KEY;
  if (!baseUrl || !apiKey) {
    logOnce("[spatial] SPATIAL_API_URL/KEY unset — Mapbox path only");
    return null;
  }
  return fetchNearby(request, { baseUrl, apiKey });
}

let logged = false;

function logOnce(message: string) {
  if (logged) return;
  logged = true;
  console.info(message);
}
