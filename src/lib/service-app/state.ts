/**
 * On-demand service interaction state machine.
 *
 * One scene at a time. One user question per scene. Transitions are explicit
 * events, never a pile of booleans. Back revises the previous decision and
 * never clears the draft.
 *
 * The states after `quote` are *truthful* lifecycle states — only move into
 * them when the backend has confirmed the corresponding fact.
 */

export const SERVICE_APP_STATES = [
  "home",
  "location_search",
  "location_pin",
  "service_select",
  "configure",
  "quote",
  "matching",
  "assigned",
  "provider_en_route",
  "active",
  "completing",
  "complete",
] as const;

export type ServiceAppState = (typeof SERVICE_APP_STATES)[number];

/**
 * How a surface change relates to the user's task.
 *
 * progress  — the task advances; the current surface may transform or be replaced.
 * interrupt — a temporary question; the current surface is suspended, not destroyed.
 * return    — the interruption is answered; the suspended surface is restored.
 */
export type TransitionIntent = "progress" | "interrupt" | "return";

export type ServiceAppEvent =
  | "open_search"
  | "choose_on_map"
  | "select_location"
  | "cancel_search"
  | "select_service"
  | "configure_done"
  | "request"
  | "matched"
  | "provider_moving"
  | "service_started"
  | "service_finishing"
  | "service_complete"
  | "back";

export type ServiceAppContext = {
  hasLocation: boolean;
  /** An *available* service is selected. */
  hasService: boolean;
  /**
   * Whether this app has anything to configure between service selection and
   * the quote. Apps with nothing to configure skip the scene entirely rather
   * than showing an empty one.
   */
  needsConfigure?: boolean;
  /**
   * Whether choosing among services is its own scene. Apps that enter with a
   * service already chosen skip `service_select`; back from configure revises
   * to location with the destination intact — it does not clear to home.
   */
  needsServiceSelect?: boolean;
  /**
   * How the rider opened the pin scene. Home map tap returns to home on Back;
   * search's "choose on map" returns to search.
   */
  pinEntry?: "home" | "search";
  /**
   * Whether the place the flow still needs is asked for *after* configuring.
   * Some flows capture their options first and the destination last, so
   * `configure_done` progresses to search rather than to the quote, and back
   * out of that search revises the options rather than clearing to home.
   *
   * Named by effect: the kit does not know which product wants this order.
   */
  locationAfterConfigure?: boolean;
  /**
   * Whether *which* service is asked after configuring rather than before.
   * Flows that must settle a shared question first — a time, a window — enter
   * on `configure`, then choose among services with that answer in hand.
   */
  selectAfterConfigure?: boolean;
};

/** The state entered once both location and service are known. */
function afterIntent(ctx: ServiceAppContext): ServiceAppState {
  // Options-then-place: reaching this with the place known means configure is
  // already behind the rider, so the next question is the price.
  if (ctx.locationAfterConfigure) return ctx.hasLocation ? "quote" : "configure";
  return ctx.needsConfigure ? "configure" : "quote";
}

/** States that describe a committed request. Back does not unwind these. */
export function isCommitted(state: ServiceAppState): boolean {
  switch (state) {
    case "matching":
    case "assigned":
    case "provider_en_route":
    case "active":
    case "completing":
    case "complete":
      return true;
    default:
      return false;
  }
}

export function reduceServiceAppState(
  state: ServiceAppState,
  event: ServiceAppEvent,
  ctx: ServiceAppContext,
): ServiceAppState {
  switch (event) {
    case "open_search":
      return isCommitted(state) ? state : "location_search";

    case "choose_on_map":
      return state === "location_search" || state === "home"
        ? "location_pin"
        : state;

    case "select_location":
      return ctx.hasService ? afterIntent(ctx) : "service_select";

    case "cancel_search":
      // Leaving a search lands where backing out of it lands: the scene that
      // asked for the place, not one step further along.
      return backServiceAppState("location_search", ctx);

    case "select_service":
      // Picking a vertical whose options come first opens those options; the
      // service itself is chosen on the far side of them.
      if (!ctx.hasService) {
        return ctx.selectAfterConfigure ? afterIntent(ctx) : state;
      }
      return ctx.hasLocation ? afterIntent(ctx) : "location_search";

    case "configure_done":
      if (state !== "configure") return state;
      // Whatever is still unknown is the next scene, in that order: which
      // service, then where, then the price.
      if (ctx.selectAfterConfigure && !ctx.hasService) return "service_select";
      if (ctx.locationAfterConfigure && !ctx.hasLocation) {
        return "location_search";
      }
      return "quote";

    // `request` is the optimistic-but-truthful step: the request has been
    // submitted, so "matching" is the honest description of what is happening.
    case "request":
      return state === "quote" ? "matching" : state;

    case "matched":
      return "assigned";
    case "provider_moving":
      return "provider_en_route";
    case "service_started":
      return "active";
    case "service_finishing":
      return "completing";
    case "service_complete":
      return "complete";

    case "back":
      return backServiceAppState(state, ctx);
  }
}

export function backServiceAppState(
  state: ServiceAppState,
  ctx: ServiceAppContext,
): ServiceAppState {
  switch (state) {
    case "home":
      return "home";
    case "location_search":
      // Options-then-place: the scene before the place is the one that asked
      // for it — the service tiles when they are a scene, else the options.
      if (ctx.locationAfterConfigure) {
        return ctx.needsServiceSelect ? "service_select" : "configure";
      }
      if (ctx.hasLocation && ctx.hasService) return afterIntent(ctx);
      return ctx.hasLocation ? "service_select" : "home";
    case "location_pin":
      return ctx.pinEntry === "home" ? "home" : "location_search";
    case "service_select":
      return ctx.selectAfterConfigure ? "configure" : "home";
    case "configure":
      if (ctx.selectAfterConfigure) return "home";
      return ctx.needsServiceSelect === false
        ? "location_search"
        : "service_select";
    case "quote":
      // The last thing answered was the place, so that is what back revises.
      if (ctx.locationAfterConfigure) return "location_search";
      return ctx.needsConfigure ? "configure" : "service_select";
    default:
      // Committed states are not unwound by Back. Leaving a committed request
      // is a cancellation — an interruption with its own confirmation.
      return state;
  }
}

/**
 * The single question each scene asks, plus its primary action and its exit.
 *
 * Use it for the live region, headings, and as a design check: a scene that
 * cannot be summarised as one question is doing too much.
 */
export function serviceAppQuestion(state: ServiceAppState): {
  question: string;
  action: string;
  exit: string;
} {
  switch (state) {
    case "home":
      return {
        question: "What do you want done, and where?",
        action: "Pick a service or a location",
        exit: "Leave home",
      };
    case "location_search":
      return {
        question: "Where?",
        action: "Select an address",
        exit: "Cancel search",
      };
    case "location_pin":
      return {
        question: "Where on the map?",
        action: "Place the pin",
        exit: "Back",
      };
    case "service_select":
      return {
        question: "What service?",
        action: "Choose a service",
        exit: "Back to home",
      };
    case "configure":
      return {
        question: "Which options?",
        action: "Continue to the quote",
        exit: "Back to services",
      };
    case "quote":
      return {
        question: "Do you want to request this?",
        action: "Request",
        exit: "Back to options",
      };
    case "matching":
      return {
        question: "Is a provider available?",
        action: "Wait",
        exit: "Cancel request",
      };
    case "assigned":
      return {
        question: "Who is coming?",
        action: "Wait",
        exit: "Cancel request",
      };
    case "provider_en_route":
      return {
        question: "Where is the provider?",
        action: "Wait",
        exit: "Cancel request",
      };
    case "active":
      return {
        question: "How is the service going?",
        action: "Follow progress",
        exit: "Cancel service",
      };
    case "completing":
      return {
        question: "Is it finished?",
        action: "Wait",
        exit: "None",
      };
    case "complete":
      return {
        question: "What happened?",
        action: "Review the result",
        exit: "Back to home",
      };
  }
}
