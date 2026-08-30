/**
 * Assist re-entry helpers — pure, testable, no React.
 */

import { isCommitted, type ServiceAppState } from "../service-app/state.ts";

export { parseAssistTiming, type AssistTiming as AssistShopTiming } from "./assist.ts";

/** Map callout copy for an immediate shop draft on the home canvas. */
export function shopDeliveryStatusLabel(etaMinutes = 45): string {
  return `Shop & deliver · ~${etaMinutes} min`;
}

export type AssistDraftResetInput = {
  wantAssist: boolean;
  state: ServiceAppState;
  rideMinimized: boolean;
  inAssistSearch: boolean;
};

/**
 * Whether Assist home should wipe a stale product draft.
 * Never clears mid-assist-search or during a live ride.
 */
export function shouldResetAssistDraft(input: AssistDraftResetInput): boolean {
  if (!input.wantAssist) return false;
  if (input.inAssistSearch) return false;
  if (input.rideMinimized) return false;
  if (isCommitted(input.state) && input.state !== "complete") return false;
  return input.state === "home";
}

/**
 * Assist ribbon tapped while a draft planning scene is still open.
 * Abort to Assist home without touching a committed ride.
 */
export function shouldAbortDraftForAssist(input: {
  wantAssist: boolean;
  state: ServiceAppState;
  enteredAssist: boolean;
}): boolean {
  if (!input.wantAssist || !input.enteredAssist) return false;
  if (isCommitted(input.state)) return false;
  return input.state !== "home" && input.state !== "location_search";
}
