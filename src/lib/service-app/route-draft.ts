import type { Location } from "@/lib/service-app/services";

/**
 * The pickup → optional stops → destination draft a search scene edits.
 *
 * Completing a *single* field does not finish the route. The scene stays open
 * until every slot has an address, then the parent may progress.
 */

export const MAX_INTERMEDIATE_STOPS = 2;

export type SearchField = "origin" | "destination" | `stop:${number}`;

export type RouteDraft = {
  origin: Location;
  destination: Location | null;
  stops: Location[];
};

export function filled(location: Location | null | undefined): boolean {
  return Boolean(location?.address.trim());
}

export function routeComplete(draft: RouteDraft): boolean {
  return (
    filled(draft.origin) &&
    filled(draft.destination) &&
    draft.stops.every(filled)
  );
}

export function nextEmptyField(draft: RouteDraft): SearchField | null {
  if (!filled(draft.origin)) return "origin";
  for (let index = 0; index < draft.stops.length; index += 1) {
    if (!filled(draft.stops[index])) return `stop:${index}`;
  }
  if (!filled(draft.destination)) return "destination";
  return null;
}

export function applyRouteChoice(
  draft: RouteDraft,
  field: SearchField,
  result: Location,
): { draft: RouteDraft; next: SearchField | "complete" } {
  const nextDraft = writeField(draft, field, result);
  const empty = nextEmptyField(nextDraft);
  return { draft: nextDraft, next: empty ?? "complete" };
}

export function addStop(
  draft: RouteDraft,
): { draft: RouteDraft; next: SearchField } | null {
  if (draft.stops.length >= MAX_INTERMEDIATE_STOPS) return null;
  const stops = [...draft.stops, { address: "" }];
  const nextDraft = { ...draft, stops };
  return { draft: nextDraft, next: `stop:${stops.length - 1}` };
}

export function removeStop(draft: RouteDraft, index: number): RouteDraft {
  return { ...draft, stops: draft.stops.filter((_, i) => i !== index) };
}

function writeField(
  draft: RouteDraft,
  field: SearchField,
  result: Location,
): RouteDraft {
  if (field === "origin") return { ...draft, origin: result };
  if (field === "destination") return { ...draft, destination: result };
  const index = Number(field.slice("stop:".length));
  return {
    ...draft,
    stops: draft.stops.map((stop, i) => (i === index ? result : stop)),
  };
}
