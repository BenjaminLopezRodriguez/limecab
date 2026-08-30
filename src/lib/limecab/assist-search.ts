import {
  assistEntries,
  type AssistPlan,
  type AssistResponse,
} from "@/lib/limecab/assist";
import type { ShopItem } from "@/lib/limecab/shop-list";
import type {
  GeocodeAdapter,
  LocationSuggestion,
} from "@/lib/service-app/geocode-adapter";
import type { Location } from "@/lib/service-app/services";

const REPLY_ONLY = "assist:reply";

/**
 * Product adapter: typing hits POST /api/assist, not Mapbox-only suggest.
 * The kit LocationSearch stays generic.
 *
 * Auto-lands only for mode "land" (one high-confidence plan). Otherwise the
 * overlay shows the assistant reply + chips for the rider to pick.
 */
export function createAssistSearchAdapter({
  origin,
  onLand,
  photoContext,
}: {
  origin: () => { latitude?: number; longitude?: number };
  onLand: (plan: AssistPlan) => void;
  photoContext?: () => {
    items?: ShopItem[];
    storeHints?: string[];
    category?: string;
    hasPhoto?: boolean;
  };
}): GeocodeAdapter & {
  planFor: (id: string) => AssistPlan | undefined;
  planMatching: (result: Location) => AssistPlan | undefined;
  lastResponse: () => AssistResponse | undefined;
} {
  const plans = new Map<string, AssistPlan>();
  let response: AssistResponse | undefined;

  return {
    planFor(id) {
      return plans.get(id);
    },
    planMatching(result) {
      for (const plan of plans.values()) {
        if (plan.title === result.address) return plan;
        if (plan.destination?.address === result.address) return plan;
        if (plan.store?.address === result.address) return plan;
      }
      return undefined;
    },
    lastResponse() {
      return response;
    },
    async suggest(query, signal) {
      response = undefined;
      plans.clear();
      const point = origin();
      const photo = photoContext?.() ?? {};
      const bodyPayload: Record<string, unknown> = {
        query,
        ...photo,
      };
      if (
        typeof point.latitude === "number" &&
        Number.isFinite(point.latitude) &&
        typeof point.longitude === "number" &&
        Number.isFinite(point.longitude)
      ) {
        bodyPayload.lat = point.latitude;
        bodyPayload.lng = point.longitude;
      }
      const res = await fetch("/api/assist", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (signal?.aborted) return [];
      if (!res.ok) {
        response = {
          mode: "reply",
          query,
          message: "Couldn't plan that just now. Try again in a moment.",
          suggestions: [],
          cards: [],
        };
        return [{ id: REPLY_ONLY, address: response.message }];
      }
      const body = (await res.json()) as AssistResponse;
      if (signal?.aborted) return [];
      response = body;
      if (body.mode === "land" && body.plan) {
        onLand(body.plan);
        return [];
      }
      const entries = assistEntries(body);
      if (entries.length === 0) {
        return body.message
          ? [{ id: REPLY_ONLY, address: body.message }]
          : [];
      }
      return entries.map((entry) => {
        plans.set(entry.id, entry.plan);
        return {
          id: entry.id,
          address: entry.plan.title,
          context: entry.plan.subtitle,
        } satisfies LocationSuggestion;
      });
    },
    async retrieve(id) {
      const plan = plans.get(id);
      const place = plan?.destination ?? plan?.store ?? plan?.pickup;
      if (!place) throw new Error("Unknown plan");
      return {
        address: place.address,
        latitude: place.latitude,
        longitude: place.longitude,
      } satisfies Location;
    },
  };
}
