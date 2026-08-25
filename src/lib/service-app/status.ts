/**
 * Semantic waiting states.
 *
 * Every wait is not the same wait. The metric shown must match the
 * uncertainty the user currently cares about:
 *
 *   matching          — will anyone take this?      → typical duration band
 *   assigned/en route — when will they get here?     → clock ETA
 *   active            — how much is left?            → step of N + remaining
 *   completing        — is it done?                  → short fixed estimate
 *
 * One generic spinner answers none of those questions. The UI derives all of
 * its copy from `serviceStatusView` — never from ad-hoc status strings.
 */

export type ServiceStatus =
  | { state: "pending"; note?: string }
  | { state: "matching"; typicalSeconds?: number }
  | { state: "assigned"; providerName?: string; etaSeconds: number }
  | { state: "provider_en_route"; providerName?: string; etaSeconds: number }
  | { state: "arriving"; providerName?: string }
  | {
      state: "active";
      completedSteps: number;
      totalSteps: number;
      currentStep?: string;
      remainingSeconds?: number;
    }
  | { state: "completing"; remainingSeconds?: number }
  | { state: "complete"; summary?: string }
  | { state: "cancelled" }
  | { state: "failed"; reason?: string };

export type ServiceStatusView = {
  headline: string;
  detail: string;
  /** Label above the estimate, e.g. "Arrival". Null when the estimate stands alone. */
  estimateLabel: string | null;
  estimate: string;
  /** Short marker text for the map, e.g. "7 MIN" or "HERE". */
  callout: string | null;
  milestones: readonly string[];
  milestoneIndex: number;
  showProgress: boolean;
  /** 0–100. Only meaningful when `showProgress` is true. */
  progress: number;
  /** True while the request is live and cancellable. */
  live: boolean;
};

export type StatusLabels = {
  /** "provider" | "driver" | "courier" | "technician" | "inspector" … */
  provider: string;
  /** "service" | "ride" | "delivery" | "job" … */
  service: string;
};

const DEFAULT_LABELS: StatusLabels = {
  provider: "provider",
  service: "service",
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** A clock-style ETA. Used when the user is waiting on someone's arrival. */
export function formatEta(seconds: number): string {
  if (seconds <= 30) return "Any moment";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

/** A duration band. Used when the answer is "how long does this usually take". */
export function formatTypical(seconds: number): string {
  if (seconds <= 60) return "Usually under 1 min";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `Usually under ${minutes} min`;
}

/** A remaining-work estimate. Used while work is visibly in progress. */
export function formatRemaining(seconds: number): string {
  if (seconds <= 45) return "Almost done";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `~${minutes} min remaining`;
}

function calloutMinutes(seconds: number) {
  return `${Math.max(1, Math.ceil(seconds / 60))} MIN`;
}

export function serviceStatusView(
  status: ServiceStatus,
  labels: Partial<StatusLabels> = {},
): ServiceStatusView {
  const l = { ...DEFAULT_LABELS, ...labels };
  const track = ["Matching", "En route", "In progress", "Done"] as const;

  switch (status.state) {
    case "pending":
      return {
        headline: "Not requested yet",
        detail: status.note ?? "Nothing is dispatched until you confirm.",
        estimateLabel: null,
        estimate: "",
        callout: null,
        milestones: track,
        milestoneIndex: 0,
        showProgress: false,
        progress: 0,
        live: false,
      };

    case "matching":
      return {
        headline: `Finding a ${l.provider}`,
        detail: `Contacting nearby ${l.provider}s`,
        estimateLabel: null,
        estimate: formatTypical(status.typicalSeconds ?? 60),
        callout: null,
        milestones: track,
        milestoneIndex: 0,
        showProgress: false,
        progress: 10,
        live: true,
      };

    case "assigned":
      return {
        headline: status.providerName
          ? `${status.providerName} is on the way`
          : `${capitalize(l.provider)} assigned`,
        detail: `Your ${l.provider} is heading to you`,
        estimateLabel: "Arriving in",
        estimate: formatEta(status.etaSeconds),
        callout: calloutMinutes(status.etaSeconds),
        milestones: track,
        milestoneIndex: 1,
        showProgress: false,
        progress: 25,
        live: true,
      };

    case "provider_en_route":
      return {
        headline: status.providerName
          ? `${status.providerName} is on the way`
          : `${capitalize(l.provider)} on the way`,
        detail: "Follow the route on the map",
        estimateLabel: "Arriving in",
        estimate: formatEta(status.etaSeconds),
        callout: calloutMinutes(status.etaSeconds),
        milestones: track,
        milestoneIndex: 1,
        showProgress: false,
        progress: 45,
        live: true,
      };

    case "arriving":
      return {
        headline: status.providerName
          ? `${status.providerName} has arrived`
          : `Your ${l.provider} has arrived`,
        detail: "Meet them outside",
        estimateLabel: null,
        estimate: "Now",
        callout: "HERE",
        milestones: track,
        milestoneIndex: 1,
        showProgress: false,
        progress: 55,
        live: true,
      };

    case "active": {
      const total = Math.max(1, status.totalSteps);
      const done = Math.min(total, Math.max(0, status.completedSteps));
      return {
        headline: `${capitalize(l.service)} in progress`,
        detail: status.currentStep ?? `${done} of ${total} steps complete`,
        estimateLabel: null,
        estimate:
          status.remainingSeconds === undefined
            ? `${done} of ${total} complete`
            : formatRemaining(status.remainingSeconds),
        callout: null,
        milestones: track,
        milestoneIndex: 2,
        showProgress: true,
        progress: Math.round((done / total) * 100),
        live: true,
      };
    }

    case "completing":
      return {
        headline: "Wrapping up",
        detail: "Preparing your receipt",
        estimateLabel: null,
        estimate:
          status.remainingSeconds === undefined
            ? "Almost done"
            : formatRemaining(status.remainingSeconds),
        callout: null,
        milestones: track,
        milestoneIndex: 2,
        showProgress: true,
        progress: 90,
        live: true,
      };

    case "complete":
      return {
        headline: `${capitalize(l.service)} complete`,
        detail: status.summary ?? "",
        estimateLabel: null,
        estimate: "",
        callout: null,
        milestones: track,
        milestoneIndex: 3,
        showProgress: false,
        progress: 100,
        live: false,
      };

    case "cancelled":
      return {
        headline: `${capitalize(l.service)} cancelled`,
        detail: "Nothing was dispatched.",
        estimateLabel: null,
        estimate: "",
        callout: null,
        milestones: track,
        milestoneIndex: 0,
        showProgress: false,
        progress: 0,
        live: false,
      };

    case "failed":
      return {
        headline: `${capitalize(l.service)} couldn't complete`,
        detail: status.reason ?? "Nothing was dispatched.",
        estimateLabel: null,
        estimate: "",
        callout: null,
        milestones: track,
        milestoneIndex: 0,
        showProgress: false,
        progress: 0,
        live: false,
      };
  }
}
