import type { LocationSuggestion } from "../service-app/geocode-adapter.ts";

import type { PlaceIntent } from "./place-intent.ts";

export type PlaceCandidate = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  source: "mapbox" | "google";
};

export type RankedPlace = PlaceCandidate & {
  score: number;
  meters: number;
};

const EARTH_M = 111_320;
const DEDUPE_M = 60;
const STREET_MATCH_BONUS = 50;
const STREET_MISS_PENALTY = 28;
const LANDMARK_CLOSE_M = 250;
const LANDMARK_NEAR_M = 500;

export function metersBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = (b.latitude - a.latitude) * EARTH_M;
  const dLng =
    (b.longitude - a.longitude) *
    EARTH_M *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

export function dedupePlaceCandidates(
  candidates: readonly PlaceCandidate[],
): PlaceCandidate[] {
  const kept: PlaceCandidate[] = [];
  for (const candidate of candidates) {
    const duplicate = kept.find(
      (other) => metersBetween(candidate, other) < DEDUPE_M,
    );
    if (!duplicate) {
      kept.push(candidate);
      continue;
    }
    if (addressQuality(candidate) > addressQuality(duplicate)) {
      kept[kept.indexOf(duplicate)] = candidate;
    }
  }
  return kept;
}

export function rankPlaceCandidates(
  candidates: readonly PlaceCandidate[],
  intent: PlaceIntent,
  origin: { latitude: number; longitude: number } | null,
  landmarks: readonly PlaceCandidate[] = [],
): RankedPlace[] {
  const unique = dedupePlaceCandidates(candidates);
  const scored = unique.map((candidate) => {
    const meters = origin
      ? metersBetween(origin, candidate)
      : Number.POSITIVE_INFINITY;
    return {
      ...candidate,
      meters,
      score: scoreCandidate(candidate, intent, meters, landmarks),
    };
  });

  const streetHits = intent.street
    ? scored.filter((candidate) => addressHasStreet(candidate, intent.street!))
    : scored;
  const poiHits = intent.poi
    ? streetHits.filter((candidate) => nameMatchesPoi(candidate, intent.poi))
    : [];
  const pool =
    poiHits.length > 0
      ? poiHits
      : streetHits.length > 0
        ? streetHits
        : scored;

  pool.sort((a, b) => {
    if (origin && intent.closest && Math.abs(a.meters - b.meters) > 40) {
      return a.meters - b.meters;
    }
    return b.score - a.score || a.meters - b.meters;
  });

  return pool;
}

export function suggestionsFromRanked(
  ranked: readonly RankedPlace[],
  limit = 8,
): LocationSuggestion[] {
  return ranked.slice(0, limit).flatMap((candidate) => {
    const display = displayAddress(candidate);
    const id = placeIdFromCandidate(candidate, display);
    if (!id) return [];
    const comma = display.indexOf(",");
    return [
      {
        id,
        address: candidate.name || display,
        context: comma >= 0 ? display.slice(comma + 1).trim() : undefined,
      },
    ];
  });
}

export function placeIdFromCandidate(
  candidate: Pick<PlaceCandidate, "latitude" | "longitude">,
  display: string,
): string | null {
  if (
    !Number.isFinite(candidate.latitude) ||
    !Number.isFinite(candidate.longitude) ||
    !display.trim()
  ) {
    return null;
  }
  return `mb:${candidate.longitude.toFixed(6)},${candidate.latitude.toFixed(6)}::${display.trim()}`;
}

export function displayAddress(candidate: PlaceCandidate): string {
  const name = candidate.name.trim();
  const address = candidate.address.trim();
  if (!name) return address;
  if (!address) return name;
  if (address.toLowerCase().startsWith(name.toLowerCase())) return address;
  return `${name}, ${address}`;
}

function scoreCandidate(
  candidate: PlaceCandidate,
  intent: PlaceIntent,
  meters: number,
  landmarks: readonly PlaceCandidate[],
): number {
  const hay = `${candidate.name} ${candidate.address}`.toLowerCase();
  let score = 0;

  if (intent.poi) {
    const poi = intent.poi.toLowerCase();
    if (hay.includes(poi)) score += 40;
    else if (tokensOverlap(hay, poi)) score += 18;
  }

  if (intent.street) {
    score += addressHasStreet(candidate, intent.street)
      ? STREET_MATCH_BONUS
      : -STREET_MISS_PENALTY;
  }

  if (intent.area && hay.includes(intent.area.toLowerCase())) {
    score += 18;
  }

  if (intent.closest || intent.nearby) {
    score += Math.max(0, 40 - meters / 200);
  } else {
    score += Math.max(0, 14 - meters / 800);
  }

  if (intent.landmark && landmarks.length > 0) {
    let nearest = Infinity;
    for (const landmark of landmarks) {
      nearest = Math.min(nearest, metersBetween(candidate, landmark));
    }
    if (nearest < LANDMARK_CLOSE_M) score += 45;
    else if (nearest < LANDMARK_NEAR_M) score += 24;
    else if (nearest < 1000) score += 8;
    else score -= 12;
  }

  return score;
}

export function addressHasStreet(
  candidate: PlaceCandidate,
  street: string,
): boolean {
  const hay = normalizeHay(`${candidate.name} ${candidate.address}`);
  const needle = normalizeHay(street);
  if (!needle) return false;
  if (hay.includes(needle)) return true;
  const compact = needle.replace(/\s+/g, "");
  return compact.length >= 6 && hay.replace(/\s+/g, "").includes(compact);
}

function normalizeHay(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(dr|drive|ave|avenue|blvd|boulevard|st|street|rd|road)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatchesPoi(candidate: PlaceCandidate, poi: string): boolean {
  const hay = `${candidate.name} ${candidate.address}`.toLowerCase();
  const needle = poi.toLowerCase();
  const name = candidate.name.toLowerCase();
  const leftover = name.replace(needle, "").trim();
  if (leftover && /^(place|plaza|dr|drive|ave|avenue|st|street|blvd|rd|road)$/i.test(leftover)) {
    return false;
  }
  return hay.includes(needle) || tokensOverlap(hay, needle);
}

function tokensOverlap(hay: string, poi: string): boolean {
  const needles = poi.split(/\s+/).filter((token) => token.length > 2);
  if (needles.length === 0) return false;
  return needles.every((token) => hay.includes(token));
}

function addressQuality(candidate: PlaceCandidate): number {
  return candidate.address.length + (candidate.name.length > 0 ? 8 : 0);
}
