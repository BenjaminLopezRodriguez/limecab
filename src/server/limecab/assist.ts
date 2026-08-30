import { z } from "zod";

import { env } from "@/env";
import {
  assistResponseFromPlans,
  nearestShop,
  placeFromFixtures,
  planAssistHeuristic,
  reconcileAssistResponse,
  shopItemsFromQuery,
  storeFromFixtures,
  type AssistKind,
  type AssistPlace,
  type AssistPlan,
  type AssistResponse,
} from "@/lib/limecab/assist";
import { resolveAssistTextcon } from "@/lib/limecab/assist-textcon";
import { SHOP_PLACES } from "@/lib/limecab/mock";
import { nearbyRestStops } from "@/lib/limecab/rest-stops";
import { searchNaturalPlaces } from "@/server/limecab/place-search";

const DEEPSEEK_MS = 2800;

const placeSchema = z.object({
  address: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  label: z.string().optional(),
});

const planSchema = z.object({
  kind: z.enum(["ride", "shop", "courier", "help", "reserve"]),
  confidence: z.enum(["high", "low"]).default("low"),
  title: z.string(),
  subtitle: z.string().optional(),
  timing: z.enum(["now", "scheduled"]).optional(),
  destination: placeSchema.optional(),
  pickup: placeSchema.optional(),
  store: placeSchema.optional(),
  items: z
    .array(
      z.object({
        label: z.string(),
        note: z.string().optional(),
        qty: z.number().optional(),
      }),
    )
    .optional(),
});

const suggestionSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  textconId: z.string().optional(),
  plan: planSchema,
});

const finalSchema = z.object({
  mode: z.enum(["land", "cards", "reply"]).optional(),
  message: z.string().optional(),
  textcons: z
    .array(
      z.object({
        id: z.string(),
        service: z
          .enum(["ride", "shop", "courier", "help", "reserve", "assist"])
          .optional(),
        label: z.string().optional(),
      }),
    )
    .optional(),
  suggestions: z.array(suggestionSchema).optional(),
  options: z.array(suggestionSchema).optional(),
  plans: z.array(planSchema).default([]),
});

const PLACE_JSON = {
  type: "object",
  properties: {
    address: { type: "string" },
    latitude: { type: "number" },
    longitude: { type: "number" },
    label: { type: "string" },
  },
  required: ["address"],
};

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "resolve_place",
      description:
        "Resolve a place, address, or nearby POI. Does not book a ride.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "find_store",
      description:
        "Find a grocery, supermarket, or pharmacy the Shop courier can buy from.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          category: { type: "string" },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "seed_shop_list",
      description: "Turn spoken grocery items into a Shop list. Does not charge.",
      parameters: {
        type: "object",
        properties: {
          items: { type: "array", items: { type: "string" } },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plan_ride",
      description:
        "Stage a ride draft to a resolved place. Never request or match.",
      parameters: {
        type: "object",
        properties: { destination: PLACE_JSON },
        required: ["destination"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plan_courier",
      description: "Stage a courier draft. Never request or match.",
      parameters: {
        type: "object",
        properties: {
          destination: PLACE_JSON,
          pickup: PLACE_JSON,
        },
        required: ["destination"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "plan_help",
      description: "Stage a Help visit draft. Never request or match.",
      parameters: {
        type: "object",
        properties: { address: PLACE_JSON },
      },
    },
  },
];

const SYSTEM = `You plan LimeCab tasks from one rider sentence. Tools actually run.
You may resolve a place, find a store, seed a shop list, or stage a ride, courier, help, or reserve draft.
Never create a live trip, never call matching, never charge, never skip the quote.
The rider always confirms on the existing product quote.

Reply with JSON only after tools (or immediately if no tool is needed):
{"mode":"land"|"reply","message":"Short conversational reply. When you mention a service, insert {{textcon:ride}} {{textcon:shop}} {{textcon:courier}} {{textcon:help}} {{textcon:reserve}} {{textcon:flowers}} {{textcon:store}} {{textcon:place}}.","textcons":[{"id":"shop","service":"shop"}],"suggestions":[{"id":"s1","plan":{"kind":"shop","confidence":"high","timing":"scheduled","title":"Order flowers tonight","subtitle":"Shop","items":[{"label":"flowers"}]}}],"plans":[]}

mode "reply" = show the message plus a mosaic of suggestion chips. Use reply when more than one service fits.
Example: "order flowers for tonight" → message with textcons + suggestions spanning shop (scheduled), ride to a florist, courier send. Do not land.
mode "land" only for one high-confidence plan with an explicit verb and a clear destination or list (ride to McDonald's, help, Griffith).
Open-ended product queries stay reply + chips. The rider taps a chip, then the app lands that plan.

Assume the rider is already here. Do not ask for pickup.
Shop timing: "order … for tonight/later" → timing "scheduled"; "deliver … now/asap" → timing "now".
Keep the rider's verb: send/package → courier; buy/shop/get/order → shop; help at home / move a couch → help. Do not turn a send into ride-only cards.`;

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
};

type ToolCall = {
  id: string;
  function: { name: string; arguments: string };
};

type ToolContext = {
  query: string;
  latitude: number;
  longitude: number;
  request: Request;
};

/**
 * Plan an Assist query. DeepSeek + tools when the key is present; heuristic
 * otherwise. Tools never request, match, or charge.
 */
export async function planAssist(input: {
  query: string;
  latitude: number;
  longitude: number;
  request: Request;
}): Promise<AssistResponse> {
  const query = input.query.trim();
  const fallback = planAssistHeuristic(query);
  const key = env.DEEPSEEK_API_KEY;
  if (!key) {
    logOnce("deepseek", "[assist] DEEPSEEK_API_KEY missing — heuristic plan");
    return enrichHeuristic(fallback, input);
  }

  try {
    const planned = await planWithDeepSeek(query, key, {
      query,
      latitude: input.latitude,
      longitude: input.longitude,
      request: input.request,
    });
    if (planned && planned.cards.length > 0) {
      return reconcileAssistResponse(query, planned);
    }
  } catch {
    console.info("[assist] DeepSeek unavailable — heuristic plan");
  }
  return enrichHeuristic(fallback, input);
}

async function enrichHeuristic(
  fallback: AssistResponse,
  input: { query: string; latitude: number; longitude: number; request: Request },
): Promise<AssistResponse> {
  if (fallback.cards.length > 0) return fallback;
  const places = await resolvePlaces(input.query, input);
  if (places.length === 0) return fallback;
  const plans: AssistPlan[] = places.slice(0, 3).map((destination) => {
    const label = destination.label ?? destination.address;
    return {
      kind: "ride",
      confidence: places.length === 1 ? "high" : "low",
      title: `Ride to ${label}`,
      subtitle: destination.address,
      destination,
    };
  });
  return assistResponseFromPlans(input.query, plans);
}

async function planWithDeepSeek(
  query: string,
  key: string,
  ctx: ToolContext,
): Promise<AssistResponse | null> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: query },
  ];

  const first = await complete(messages, key, true);
  if (!first) return null;

  if (first.tool_calls?.length) {
    messages.push({
      role: "assistant",
      content: first.content ?? "",
      tool_calls: first.tool_calls,
    });
    const results = await Promise.all(
      first.tool_calls.map((call) => runTool(call, ctx)),
    );
    for (const result of results) {
      messages.push({
        role: "tool",
        tool_call_id: result.id,
        content: result.content,
      });
    }
    const second = await complete(messages, key, false);
    if (!second?.content) return null;
    return parseFinal(query, second.content, collectStagedPlans(results));
  }

  if (!first.content) return null;
  return parseFinal(query, first.content, []);
}

async function complete(
  messages: ChatMessage[],
  key: string,
  withTools: boolean,
): Promise<{ content?: string; tool_calls?: ToolCall[] } | null> {
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
      ...(withTools
        ? { tools: TOOLS, tool_choice: "auto" }
        : { response_format: { type: "json_object" } }),
      messages: messages.map((message) => {
        if (message.role === "tool") {
          return {
            role: "tool",
            tool_call_id: message.tool_call_id,
            content: message.content,
          };
        }
        if (message.tool_calls) {
          return {
            role: "assistant",
            content: message.content,
            tool_calls: message.tool_calls.map((call) => ({
              id: call.id,
              type: "function",
              function: call.function,
            })),
          };
        }
        return { role: message.role, content: message.content };
      }),
    }),
  });
  if (!res.ok) {
    console.info(`[assist] DeepSeek ${res.status} — heuristic plan`);
    return null;
  }
  const body = (await res.json()) as {
    choices?: {
      message?: {
        content?: string;
        tool_calls?: {
          id: string;
          function?: { name?: string; arguments?: string };
        }[];
      };
    }[];
  };
  const message = body.choices?.[0]?.message;
  if (!message) return null;
  const tool_calls = (message.tool_calls ?? [])
    .filter((call) => call.function?.name)
    .map((call) => ({
      id: call.id,
      function: {
        name: call.function!.name!,
        arguments: call.function?.arguments ?? "{}",
      },
    }));
  return {
    content: message.content,
    tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
  };
}

async function runTool(
  call: ToolCall,
  ctx: ToolContext,
): Promise<{ id: string; content: string; plan?: AssistPlan }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(call.function.arguments) as Record<string, unknown>;
  } catch {
    args = {};
  }

  try {
    if (call.function.name === "resolve_place") {
      const q = stringArg(args.query) || ctx.query;
      const places = await resolvePlaces(q, ctx);
      return { id: call.id, content: JSON.stringify({ places }) };
    }
    if (call.function.name === "find_store") {
      const q = stringArg(args.query);
      const stores = findStores(q, ctx);
      return { id: call.id, content: JSON.stringify({ stores }) };
    }
    if (call.function.name === "seed_shop_list") {
      const listed = Array.isArray(args.items)
        ? args.items
            .filter((item): item is string => typeof item === "string")
            .map((label) => ({ label: label.trim() }))
            .filter((item) => item.label.length > 0)
        : shopItemsFromQuery(ctx.query);
      return { id: call.id, content: JSON.stringify({ items: listed }) };
    }
    if (call.function.name === "plan_ride") {
      const destination = readPlace(args.destination) ?? placeFromFixtures(ctx.query);
      if (!destination) {
        return { id: call.id, content: JSON.stringify({ error: "Need a place" }) };
      }
      const plan = ridePlan(destination);
      return { id: call.id, content: JSON.stringify({ plan }), plan };
    }
    if (call.function.name === "plan_courier") {
      const destination =
        readPlace(args.destination) ?? placeFromFixtures(ctx.query);
      if (!destination) {
        return { id: call.id, content: JSON.stringify({ error: "Need a drop-off" }) };
      }
      const plan: AssistPlan = {
        kind: "courier",
        confidence: "high",
        title: "Send a package",
        subtitle: destination.address,
        destination,
        pickup: readPlace(args.pickup),
      };
      return { id: call.id, content: JSON.stringify({ plan }), plan };
    }
    if (call.function.name === "plan_help") {
      const destination = readPlace(args.address);
      const plan: AssistPlan = {
        kind: "help",
        confidence: "high",
        title: "Help at home",
        subtitle: destination?.address ?? "A helper comes here",
        destination,
      };
      return { id: call.id, content: JSON.stringify({ plan }), plan };
    }
  } catch (error) {
    return {
      id: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : "Tool failed",
      }),
    };
  }

  return { id: call.id, content: JSON.stringify({ error: "Unknown tool" }) };
}

function collectStagedPlans(
  results: { plan?: AssistPlan }[],
): AssistPlan[] {
  return results.flatMap((result) => (result.plan ? [result.plan] : []));
}

function parseFinal(
  query: string,
  content: string,
  staged: AssistPlan[],
): AssistResponse | null {
  try {
    const parsed = finalSchema.safeParse(JSON.parse(content));
    if (!parsed.success) {
      return staged.length ? assistResponseFromPlans(query, staged) : null;
    }
    const wrapped = parsed.data.suggestions?.length
      ? parsed.data.suggestions
      : (parsed.data.options ?? []);
    const fromWrapped = wrapped.map((entry) => {
      const plan = normalizePlan(entry.plan);
      return {
        ...plan,
        title: entry.title ?? plan.title,
        subtitle: entry.subtitle ?? plan.subtitle,
      };
    });
    const fromModel = parsed.data.plans.map(normalizePlan);
    const plans =
      fromWrapped.length > 0
        ? fromWrapped
        : fromModel.length > 0
          ? fromModel
          : staged;
    if (plans.length === 0) return null;
    const built = assistResponseFromPlans(query, plans);
    const textcons =
      parsed.data.textcons?.map((ref) => ({
        id: ref.id,
        service:
          ref.service ?? resolveAssistTextcon(ref.id)?.service ?? "assist",
        label: ref.label ?? resolveAssistTextcon(ref.id)?.label,
      })) ?? built.textcons;
    const merged: AssistResponse = {
      ...built,
      message: parsed.data.message?.trim()
        ? parsed.data.message
        : built.message,
      textcons,
    };
    if (parsed.data.mode === "cards" || parsed.data.mode === "reply") {
      return { ...merged, mode: parsed.data.mode, plan: undefined };
    }
    return merged;
  } catch {
    return staged.length ? assistResponseFromPlans(query, staged) : null;
  }
}

function normalizePlan(plan: z.infer<typeof planSchema>): AssistPlan {
  return {
    kind: plan.kind,
    confidence: plan.confidence,
    title: plan.title,
    subtitle: plan.subtitle,
    timing: plan.timing,
    destination: plan.destination,
    pickup: plan.pickup,
    store: plan.store,
    items: plan.items,
  };
}

async function resolvePlaces(
  query: string,
  ctx: ToolContext,
): Promise<AssistPlace[]> {
  const fixture = placeFromFixtures(query);
  try {
    const suggestions = await searchNaturalPlaces({
      query,
      latitude: ctx.latitude,
      longitude: ctx.longitude,
      request: ctx.request,
    });
    const live = suggestions.flatMap((suggestion) => {
      const decoded = placeFromSuggestionId(suggestion.id, suggestion.address);
      return decoded ? [decoded] : [];
    });
    if (live.length > 0) return live;
  } catch {
    /* vendors down — fixtures still answer */
  }
  return fixture ? [fixture] : [];
}

function findStores(query: string, ctx: ToolContext): AssistPlace[] {
  const named = query ? storeFromFixtures(query) : null;
  if (named) return [named];
  const nearby = nearbyRestStops(
    { address: "", latitude: ctx.latitude, longitude: ctx.longitude },
    SHOP_PLACES,
    { limit: 5, maxMiles: 40 },
  );
  if (nearby.length > 0) {
    return nearby.map((stop) => ({
      address: stop.address,
      latitude: stop.latitude,
      longitude: stop.longitude,
      label: stop.shortName,
    }));
  }
  const fallback = nearestShop();
  return fallback ? [fallback] : [];
}

function placeFromSuggestionId(
  id: string,
  address: string,
): AssistPlace | null {
  if (!id.startsWith("mb:")) {
    return placeFromFixtures(address) ?? { address };
  }
  const payload = id.slice(3);
  const split = payload.indexOf("::");
  if (split < 0) return { address };
  const [lngRaw, latRaw] = payload.slice(0, split).split(",");
  const longitude = Number(lngRaw);
  const latitude = Number(latRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { address };
  }
  return { address, latitude, longitude };
}

function ridePlan(destination: AssistPlace): AssistPlan {
  const label = destination.label ?? destination.address;
  return {
    kind: "ride",
    confidence: "high",
    title: `Ride to ${label}`,
    subtitle: destination.address,
    destination,
  };
}

function readPlace(value: unknown): AssistPlace | undefined {
  const parsed = placeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function stringArg(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const logged = new Set<string>();

function logOnce(key: string, message: string) {
  if (logged.has(key)) return;
  logged.add(key);
  console.info(message);
}

export type { AssistKind };
