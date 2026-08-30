import { z } from "zod";

import { env } from "@/env";
import {
  expandLandmark,
  expandPoi,
  needsModelParse,
  parsePlaceIntent,
  vendorQueryFor,
  type PlaceIntent,
} from "@/lib/limecab/place-intent";
import {
  rankPlaceCandidates,
  suggestionsFromRanked,
  type PlaceCandidate,
} from "@/lib/limecab/place-rank";
import type { SearchBoxFeature } from "@/lib/limecab/pickup-points";
import type { LocationSuggestion } from "@/lib/service-app/geocode-adapter";

import { mapboxFetch, mapboxToken } from "./mapbox";

const DEEPSEEK_MS = 1200;
const VENDOR_MS = 2800;
const BIAS_M = 30_000;

const intentSchema = z.object({
  poi: z.string().default(""),
  street: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  landmark: z.string().nullable().optional(),
  closest: z.boolean().optional(),
  nearby: z.boolean().optional(),
});

const DEEPSEEK_SYSTEM = `Extract place-search intent from a rider query. Reply with JSON only:
{"poi":"brand or place name","street":"street or null","area":"neighborhood/city or null","landmark":"relative landmark or null","closest":false,"nearby":false}
Expand shorthand (711→7-Eleven, mcdonalds→McDonald's). street is a road constraint ("the one on Las Tunas"). landmark is what it is next to ("chinese restaurant"). closest/nearby are true only when the rider asked for nearest or near me.`;

/**
 * NL query → structured intent → Mapbox + Google → ranked suggestions.
 *
 * Missing keys degrade: heuristic if DeepSeek is unset, Mapbox-only if
 * Google is unset. Logs once per missing vendor so the gap is obvious.
 */
export async function searchNaturalPlaces(input: {
  query: string;
  latitude?: number;
  longitude?: number;
  request: Request;
}): Promise<LocationSuggestion[]> {
  const origin =
    typeof input.latitude === "number" &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === "number" &&
    Number.isFinite(input.longitude)
      ? { latitude: input.latitude, longitude: input.longitude }
      : null;
  const heuristic = parsePlaceIntent(input.query);
  const intent = await resolveIntent(input.query, heuristic);
  const vendorQuery = vendorQueryFor(intent, input.query);
  if (vendorQuery.length < 2) return [];

  const token = mapboxToken();
  const googleKey = env.GOOGLE_PLACES_API_KEY;
  if (!token && !googleKey) {
    console.info("[place-search] No Mapbox or Google Places key");
    return [];
  }
  if (!googleKey) {
    logOnce("google", "[place-search] GOOGLE_PLACES_API_KEY missing — Mapbox only");
  }
  if (!token) {
    logOnce("mapbox", "[place-search] MAPBOX_TOKEN missing — Google only");
  }

  const landmarkQuery = expandLandmark(intent.landmark);

  const vendorInput = {
    origin,
    request: input.request,
    token,
    googleKey,
  };
  const [primary, landmarks, adjacent] = await Promise.all([
    lookupVendors({
      ...vendorInput,
      query: vendorQuery,
      preferDistance: Boolean(origin && (intent.closest || intent.nearby)),
    }),
    landmarkQuery
      ? lookupVendors({
          ...vendorInput,
          query: landmarkQuery,
          preferDistance: Boolean(origin),
        })
      : Promise.resolve([] as PlaceCandidate[]),
    landmarkQuery && intent.poi
      ? lookupVendors({
          ...vendorInput,
          query: `${intent.poi} near ${landmarkQuery}`,
          preferDistance: Boolean(origin),
        })
      : Promise.resolve([] as PlaceCandidate[]),
  ]);

  return suggestionsFromRanked(
    rankPlaceCandidates([...primary, ...adjacent], intent, origin, landmarks),
  );
}

async function resolveIntent(
  query: string,
  heuristic: PlaceIntent,
): Promise<PlaceIntent> {
  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    logOnce("deepseek", "[place-search] DEEPSEEK_API_KEY missing — heuristic parse");
    return heuristic;
  }
  if (!needsModelParse(query, heuristic)) return heuristic;

  const parsed = await parseWithDeepSeek(query, key);
  if (!parsed) return heuristic;

  const poi = expandPoi(parsed.poi);
  return {
    poi: poi.length > 0 ? poi : heuristic.poi,
    street: parsed.street?.trim() ?? heuristic.street,
    area: parsed.area?.trim() ?? heuristic.area,
    landmark: expandLandmark(parsed.landmark) ?? heuristic.landmark,
    closest: parsed.closest ? true : heuristic.closest,
    nearby: parsed.nearby ? true : heuristic.nearby,
  };
}

async function parseWithDeepSeek(
  query: string,
  key: string,
): Promise<PlaceIntent | null> {
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(DEEPSEEK_MS),
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: DEEPSEEK_SYSTEM },
          { role: "user", content: query },
        ],
      }),
    });
    if (!res.ok) {
      console.info(`[place-search] DeepSeek ${res.status} — heuristic parse`);
      return null;
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = intentSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      console.info("[place-search] DeepSeek JSON invalid — heuristic parse");
      return null;
    }
    return {
      poi: parsed.data.poi.trim(),
      street: parsed.data.street?.trim() ?? null,
      area: parsed.data.area?.trim() ?? null,
      landmark: parsed.data.landmark?.trim() ?? null,
      closest: parsed.data.closest ?? false,
      nearby: parsed.data.nearby ?? false,
    };
  } catch {
    console.info("[place-search] DeepSeek unavailable — heuristic parse");
    return null;
  }
}

async function lookupVendors(input: {
  query: string;
  origin: { latitude: number; longitude: number } | null;
  request: Request;
  token: string | undefined;
  googleKey: string | undefined;
  preferDistance: boolean;
}): Promise<PlaceCandidate[]> {
  const lookups: Promise<PlaceCandidate[]>[] = [];
  if (input.token) {
    lookups.push(
      mapboxGeocode(input.query, input.origin, input.token, input.request),
    );
    lookups.push(
      mapboxSearchBox(input.query, input.origin, input.token, input.request),
    );
  }
  if (input.googleKey) {
    lookups.push(
      googleTextSearch(
        input.query,
        input.origin,
        input.googleKey,
        input.preferDistance,
      ),
    );
  }
  const batches = await Promise.all(lookups);
  return batches.flat();
}

async function mapboxGeocode(
  query: string,
  origin: { latitude: number; longitude: number } | null,
  token: string,
  request: Request,
): Promise<PlaceCandidate[]> {
  const endpoint = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`,
  );
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("autocomplete", "true");
  endpoint.searchParams.set("limit", "6");
  endpoint.searchParams.set("types", "address,poi,place,locality,neighborhood");
  if (origin) {
    endpoint.searchParams.set(
      "proximity",
      `${origin.longitude},${origin.latitude}`,
    );
  }
  endpoint.searchParams.set("country", "US");

  const res = await vendorFetch(endpoint, request);
  if (!res?.ok) return [];
  const body = (await res.json()) as {
    features?: {
      text?: string;
      place_name?: string;
      center?: [number, number];
    }[];
  };
  return (body.features ?? []).flatMap((feature) => {
    const center = feature.center;
    const name = feature.text?.trim() ?? feature.place_name?.trim();
    const address = feature.place_name?.trim() ?? name;
    if (!center || center.length < 2 || !name || !address) return [];
    const [lng, lat] = center;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return [];
    return [{ name, address, latitude: lat, longitude: lng, source: "mapbox" }];
  });
}

async function mapboxSearchBox(
  query: string,
  origin: { latitude: number; longitude: number } | null,
  token: string,
  request: Request,
): Promise<PlaceCandidate[]> {
  const endpoint = new URL("https://api.mapbox.com/search/searchbox/v1/forward");
  endpoint.searchParams.set("access_token", token);
  endpoint.searchParams.set("q", query.slice(0, 256));
  endpoint.searchParams.set("language", "en");
  endpoint.searchParams.set("limit", "8");
  if (origin) {
    endpoint.searchParams.set(
      "proximity",
      `${origin.longitude},${origin.latitude}`,
    );
  }
  endpoint.searchParams.set("country", "US");

  const res = await vendorFetch(endpoint, request);
  if (!res?.ok) return [];
  const body = (await res.json()) as { features?: SearchBoxFeature[] };
  return (body.features ?? []).flatMap((feature) => {
    const props = feature.properties;
    const lng =
      props?.coordinates?.longitude ?? feature.geometry?.coordinates?.[0];
    const lat =
      props?.coordinates?.latitude ?? feature.geometry?.coordinates?.[1];
    const name = props?.name?.trim();
    const address =
      props?.full_address?.trim() ??
      props?.place_formatted?.trim() ??
      name;
    if (
      typeof lng !== "number" ||
      typeof lat !== "number" ||
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      !name ||
      !address
    ) {
      return [];
    }
    return [{ name, address, latitude: lat, longitude: lng, source: "mapbox" }];
  });
}

async function googleTextSearch(
  query: string,
  origin: { latitude: number; longitude: number } | null,
  key: string,
  preferDistance: boolean,
): Promise<PlaceCandidate[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(VENDOR_MS),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "en",
        regionCode: "US",
        pageSize: 8,
        rankPreference: preferDistance && origin ? "DISTANCE" : "RELEVANCE",
        ...(origin
          ? {
              locationBias: {
                circle: {
                  center: {
                    latitude: origin.latitude,
                    longitude: origin.longitude,
                  },
                  radius: BIAS_M,
                },
              },
            }
          : {}),
      }),
    });
    if (!res.ok) {
      console.info(`[place-search] Google Places ${res.status}`);
      return [];
    }
    const body = (await res.json()) as {
      places?: {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      }[];
    };
    return (body.places ?? []).flatMap((place) => {
      const name = place.displayName?.text?.trim();
      const address = place.formattedAddress?.trim() ?? name;
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      if (
        !name ||
        !address ||
        typeof lat !== "number" ||
        typeof lng !== "number"
      ) {
        return [];
      }
      return [{ name, address, latitude: lat, longitude: lng, source: "google" }];
    });
  } catch {
    console.info("[place-search] Google Places unavailable");
    return [];
  }
}

async function vendorFetch(
  endpoint: URL,
  request: Request,
): Promise<Response | null> {
  try {
    return await mapboxFetch(endpoint, request, {
      signal: AbortSignal.timeout(VENDOR_MS),
    });
  } catch {
    return null;
  }
}

const logged = new Set<string>();

function logOnce(key: string, message: string) {
  if (logged.has(key)) return;
  logged.add(key);
  console.info(message);
}
