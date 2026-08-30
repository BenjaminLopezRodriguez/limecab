import { bearingDegrees, type MapPoint } from "../service-app/map-adapter.ts";

/**
 * Uber-style pickup candidates for a chosen place.
 *
 * A geocode centroid sits on the parcel. Cars stop on a curb, a driveway, or
 * a named access point. This module turns vendor hints (Search Box routable
 * points, a road snap, a short road geometry) into the discrete spots the
 * confirm-pickup map highlights.
 */

export type PickupCandidateSource = "access" | "curb" | "custom";

export type PickupCandidate = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  source: PickupCandidateSource;
  /** Higher is a better default. */
  score: number;
  address?: string;
};

export type SearchBoxRoutablePoint = {
  name?: string;
  note?: string;
  latitude?: number;
  longitude?: number;
};

export type SearchBoxFeature = {
  properties?: {
    name?: string;
    full_address?: string;
    place_formatted?: string;
    feature_type?: string;
    poi_category?: string[];
    poi_category_ids?: string[];
    coordinates?: {
      latitude?: number;
      longitude?: number;
      routable_points?: SearchBoxRoutablePoint[];
    };
  };
  geometry?: { coordinates?: number[] };
};

export type PickupPointPlace = {
  latitude: number;
  longitude: number;
  address?: string;
};

const EARTH_M = 111_320;
const DEDUPE_M = 22;
const SNAP_KEEP_M = 15;
const STREET_ACCESS_M = 90;
const VENUE_ACCESS_M = 320;
const ALONG_ROAD_M = [50] as const;
const VENUE_CAP = 5;
const STREET_CAP = 3;
const PLACE_STOPWORDS = new Set([
  "los",
  "angeles",
  "california",
  "united",
  "states",
  "ca",
  "us",
  "the",
  "and",
  "of",
  "street",
  "avenue",
  "ave",
  "st",
  "blvd",
  "boulevard",
  "road",
  "rd",
  "drive",
  "dr",
  "north",
  "south",
  "east",
  "west",
  "n",
  "s",
  "e",
  "w",
]);

const VENUE_HINT =
  /\b(airport|terminal|mall|station|stadium|arena|university|hospital|campus|center|centre|depot|amphitheatre|coliseum|park|plaza)\b/i;

const VENUE_CATEGORIES = new Set([
  "airport",
  "bus_station",
  "train_station",
  "transit_station",
  "stadium",
  "arena",
  "shopping_mall",
  "mall",
  "hospital",
  "university",
  "college",
  "park",
  "theme_park",
  "museum",
]);

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

export function isVenuePlace(
  place: PickupPointPlace,
  features: readonly SearchBoxFeature[] = [],
): boolean {
  if (place.address && VENUE_HINT.test(place.address)) return true;
  return features.some((feature) => {
    const name = feature.properties?.name;
    if (name && VENUE_HINT.test(name)) return true;
    const cats = [
      ...(feature.properties?.poi_category ?? []),
      ...(feature.properties?.poi_category_ids ?? []),
    ];
    return cats.some((cat) => VENUE_CATEGORIES.has(cat));
  });
}

export function labelRoutablePoint(
  point: SearchBoxRoutablePoint,
  placeName?: string,
): string {
  const note = point.note?.trim();
  if (note) return note;
  const raw = point.name?.trim() ?? "";
  const key = raw.toLowerCase();
  if (key === "driving" || key === "default" || key === "address") {
    return "Curb";
  }
  if (key === "walking") return "Entrance";
  if (key === "poi") return placeName?.trim() ?? "Pickup";
  if (raw && raw.length <= 40) return raw;
  return placeName?.trim() ?? "Pickup";
}

export type SpotFace = "front" | "side" | "back";

const GENERIC_SPOT =
  /^(curb|entrance|pickup|north curb|south curb|east curb|west curb)$/i;

/** Named gates stay; a POI's own name ("Central Library") is not a spot. */
const ACCESS_VOCAB =
  /\b(entrance|gate|terminal|door|curb|driveway|drop-?off|pickup|lobby|porte|departures?|arrivals?)\b/i;

const SPOT_FACE: Record<SpotFace, string> = {
  front: "Front entrance",
  side: "Side entrance",
  back: "Back entrance",
};

/** Vendor notes and named gates stay; "Curb" / "Entrance" get a building face. */
export function isDistinctSpotName(label: string): boolean {
  const key = label.trim().toLowerCase();
  if (!key || GENERIC_SPOT.test(key)) return false;
  return ACCESS_VOCAB.test(key);
}

function oppositeDelta(from: number, to: number): number {
  return Math.abs(((to - from + 540) % 360) - 180);
}

export function assignSpotFaces(
  place: PickupPointPlace,
  candidates: readonly PickupCandidate[],
): Map<string, SpotFace> {
  const faces = new Map<string, SpotFace>();
  if (candidates.length === 0) return faces;
  const nearest = [...candidates].sort(
    (a, b) => metersBetween(place, a) - metersBetween(place, b),
  );
  const front = nearest[0]!;
  faces.set(front.id, "front");
  if (nearest.length === 1) return faces;

  if (nearest.length >= 3) {
    faces.set(nearest[nearest.length - 1]!.id, "back");
    for (const candidate of nearest.slice(1, -1)) {
      faces.set(candidate.id, "side");
    }
    return faces;
  }

  const other = nearest[1]!;
  const opposite = oppositeDelta(
    bearingDegrees(place, front),
    bearingDegrees(place, other),
  );
  faces.set(other.id, opposite < 80 ? "back" : "side");
  return faces;
}

/**
 * Same-address spots: keep a named gate ("Alameda entrance"), otherwise
 * Front / Side / Back from where the curb sits around the parcel. A POI's
 * own name is not a spot. Does not invent extra points.
 */
export function nameSameAddressSpots(
  place: PickupPointPlace,
  candidates: readonly PickupCandidate[],
): PickupCandidate[] {
  const faces = assignSpotFaces(place, candidates);
  return candidates.map((candidate) => {
    if (candidate.source === "custom" || isDistinctSpotName(candidate.label)) {
      return candidate;
    }
    const face = faces.get(candidate.id);
    return face ? { ...candidate, label: SPOT_FACE[face] } : candidate;
  });
}

export function cardinalCurbLabel(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): string {
  const dLat = to.latitude - from.latitude;
  const dLng = to.longitude - from.longitude;
  if (Math.abs(dLat) < 1e-9 && Math.abs(dLng) < 1e-9) return "Curb";
  const northish = Math.abs(dLat) >= Math.abs(dLng);
  if (northish) return dLat >= 0 ? "North curb" : "South curb";
  return dLng >= 0 ? "East curb" : "West curb";
}

function featureCoords(
  feature: SearchBoxFeature,
): { latitude: number; longitude: number } | null {
  const lat = feature.properties?.coordinates?.latitude;
  const lng = feature.properties?.coordinates?.longitude;
  if (typeof lat === "number" && typeof lng === "number") {
    return { latitude: lat, longitude: lng };
  }
  const longitude = feature.geometry?.coordinates?.[0];
  const latitude = feature.geometry?.coordinates?.[1];
  if (typeof latitude === "number" && typeof longitude === "number") {
    return { latitude, longitude };
  }
  return null;
}

function placeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !PLACE_STOPWORDS.has(token));
}

/**
 * Nearby Search Box hits are other businesses on the block. Only keep the
 * feature that is the chosen place — or, at a venue, other access of the
 * same venue — so a pretzel shop is not a Union Station pickup.
 */
export function featureBelongsToPlace(
  feature: SearchBoxFeature,
  place: PickupPointPlace,
  venue: boolean,
): boolean {
  const at = featureCoords(feature);
  if (!at) return false;
  const radius = venue ? VENUE_ACCESS_M : STREET_ACCESS_M;
  if (metersBetween(place, at) > radius) return false;

  const query = place.address?.trim() ?? "";
  if (!query) return metersBetween(place, at) <= STREET_ACCESS_M;

  const tokens = placeTokens(query);
  if (tokens.length === 0) return metersBetween(place, at) <= STREET_ACCESS_M;

  const hay = [
    feature.properties?.name,
    feature.properties?.full_address,
    feature.properties?.place_formatted,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hits = tokens.filter((token) => hay.includes(token)).length;
  if (hits >= Math.min(2, tokens.length)) return true;
  if (hits === 1 && tokens.length === 1) return true;

  const cats = [
    ...(feature.properties?.poi_category ?? []),
    ...(feature.properties?.poi_category_ids ?? []),
  ];
  return venue && cats.some((cat) => VENUE_CATEGORIES.has(cat));
}

export function closestPickupCandidate(
  point: { latitude: number; longitude: number },
  candidates: readonly PickupCandidate[],
  withinMeters = 25,
): PickupCandidate | null {
  let best: PickupCandidate | null = null;
  let bestM = withinMeters;
  for (const candidate of candidates) {
    const meters = metersBetween(point, candidate);
    if (meters <= bestM) {
      best = candidate;
      bestM = meters;
    }
  }
  return best;
}

export function pickupPointsAsMapPoints(
  points: readonly PickupCandidate[],
  selectedId: string | null,
): MapPoint[] {
  return points.map((point) => ({
    latitude: point.latitude,
    longitude: point.longitude,
    kind: "pickup" as const,
    label: point.label,
    selected: point.id === selectedId,
  }));
}

/**
 * Walk a road geometry ±50m from the snapped curb so a street address still
 * offers nearby curb choices when Mapbox has no named access points.
 */
export function curbOffsetsAlongPath(
  path: readonly MapPoint[],
  origin: { latitude: number; longitude: number },
): MapPoint[] {
  if (path.length < 2) return [];
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const length = metersBetween(prev, next);
    lengths.push(length);
    total += length;
  }
  if (total === 0) return [];

  let walked = 0;
  let at = 0;
  let nearest = Infinity;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const length = lengths[i - 1]!;
    if (length === 0) {
      walked += length;
      continue;
    }
    const eastM =
      (next.longitude - prev.longitude) *
      EARTH_M *
      Math.cos((prev.latitude * Math.PI) / 180);
    const northM = (next.latitude - prev.latitude) * EARTH_M;
    const toEast =
      (origin.longitude - prev.longitude) *
      EARTH_M *
      Math.cos((prev.latitude * Math.PI) / 180);
    const toNorth = (origin.latitude - prev.latitude) * EARTH_M;
    const u = Math.min(
      1,
      Math.max(0, (toEast * eastM + toNorth * northM) / (length * length)),
    );
    const dist = Math.hypot(toEast - eastM * u, toNorth - northM * u);
    if (dist < nearest) {
      nearest = dist;
      at = walked + u * length;
    }
    walked += length;
  }

  const points: MapPoint[] = [];
  for (const delta of ALONG_ROAD_M) {
    for (const sign of [-1, 1] as const) {
      const target = Math.min(total, Math.max(0, at + sign * delta));
      if (Math.abs(target - at) < 8) continue;
      points.push(pointAtDistance(path, lengths, target));
    }
  }
  return points;
}

function pointAtDistance(
  path: readonly MapPoint[],
  lengths: readonly number[],
  meters: number,
): MapPoint {
  let remaining = meters;
  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]!;
    const next = path[i]!;
    const length = lengths[i - 1]!;
    if (remaining <= length) {
      const u = length === 0 ? 1 : remaining / length;
      return {
        latitude: prev.latitude + (next.latitude - prev.latitude) * u,
        longitude: prev.longitude + (next.longitude - prev.longitude) * u,
      };
    }
    remaining -= length;
  }
  return path[path.length - 1]!;
}

function candidateId(
  source: PickupCandidateSource,
  latitude: number,
  longitude: number,
): string {
  return `${source}:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function scoreRoutable(name?: string): number {
  const key = name?.trim().toLowerCase() ?? "";
  if (key === "driving") return 100;
  if (key === "walking") return 90;
  if (key === "poi" || key === "address") return 80;
  return 85;
}

function dedupeCandidates(
  candidates: PickupCandidate[],
): PickupCandidate[] {
  const kept: PickupCandidate[] = [];
  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  for (const candidate of ranked) {
    const near = kept.find(
      (other) => metersBetween(candidate, other) < DEDUPE_M,
    );
    if (near) continue;
    kept.push(candidate);
  }
  return kept.sort((a, b) => b.score - a.score);
}

export function pickupPointsFromVendor(input: {
  place: PickupPointPlace;
  features?: readonly SearchBoxFeature[];
  snap?: { latitude: number; longitude: number } | null;
  roadPath?: readonly MapPoint[] | null;
}): PickupCandidate[] {
  const { place } = input;
  const features = input.features ?? [];
  // Address only — a stadium next door must not enlarge a house's radius.
  const venue = isVenuePlace(place);
  const collected: PickupCandidate[] = [];

  for (const feature of features) {
    if (!featureBelongsToPlace(feature, place, venue)) continue;
    const placeName = feature.properties?.name;
    const address =
      feature.properties?.full_address ??
      feature.properties?.place_formatted ??
      place.address;
    const routable = feature.properties?.coordinates?.routable_points ?? [];
    for (const point of routable) {
      if (
        typeof point.latitude !== "number" ||
        typeof point.longitude !== "number" ||
        !Number.isFinite(point.latitude) ||
        !Number.isFinite(point.longitude)
      ) {
        continue;
      }
      collected.push({
        id: candidateId("access", point.latitude, point.longitude),
        latitude: point.latitude,
        longitude: point.longitude,
        label: labelRoutablePoint(point, placeName),
        source: "access",
        score: scoreRoutable(point.name),
        ...(address ? { address } : {}),
      });
    }
  }

  const snap = input.snap;
  if (
    snap &&
    Number.isFinite(snap.latitude) &&
    Number.isFinite(snap.longitude)
  ) {
    const nearAccess = collected.some(
      (candidate) => metersBetween(snap, candidate) < SNAP_KEEP_M,
    );
    if (!nearAccess) {
      collected.push({
        id: candidateId("curb", snap.latitude, snap.longitude),
        latitude: snap.latitude,
        longitude: snap.longitude,
        label: "Curb",
        source: "curb",
        score: 70,
        ...(place.address ? { address: place.address } : {}),
      });
    }
  }

  const accessCount = collected.filter((c) => c.source === "access").length;
  if (input.roadPath && (venue || accessCount < 2)) {
    const origin = snap ?? place;
    for (const offset of curbOffsetsAlongPath(input.roadPath, origin)) {
      const near = collected.some(
        (candidate) => metersBetween(offset, candidate) < DEDUPE_M,
      );
      if (near) continue;
      collected.push({
        id: candidateId("curb", offset.latitude, offset.longitude),
        latitude: offset.latitude,
        longitude: offset.longitude,
        label: cardinalCurbLabel(place, offset),
        source: "curb",
        score: 50,
        ...(place.address ? { address: place.address } : {}),
      });
    }
  }

  const ranked = dedupeCandidates(collected).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return metersBetween(place, a) - metersBetween(place, b);
  });
  const cap = venue ? VENUE_CAP : STREET_CAP;
  if (ranked.length > 0) {
    return preferFrontSpot(nameSameAddressSpots(place, ranked.slice(0, cap)));
  }

  const fallback = snap ?? place;
  return preferFrontSpot(nameSameAddressSpots(place, [
    {
      id: candidateId("curb", fallback.latitude, fallback.longitude),
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      label: "Curb",
      source: "curb",
      score: snap ? 70 : 10,
      ...(place.address ? { address: place.address } : {}),
    },
  ]));
}

function preferFrontSpot(candidates: PickupCandidate[]): PickupCandidate[] {
  return [...candidates].sort((a, b) => {
    const rank = (candidate: PickupCandidate) =>
      candidate.label === "Front entrance" ? 0 : 1;
    return rank(a) - rank(b) || b.score - a.score;
  });
}

export function upsertCustomPickup(
  candidates: readonly PickupCandidate[],
  point: { latitude: number; longitude: number },
  address?: string,
): PickupCandidate[] {
  const custom: PickupCandidate = {
    id: "custom",
    latitude: point.latitude,
    longitude: point.longitude,
    label: "Pickup",
    source: "custom",
    score: 40,
    ...(address ? { address } : {}),
  };
  return [...candidates.filter((candidate) => candidate.id !== "custom"), custom];
}
