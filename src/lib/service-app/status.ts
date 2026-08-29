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

/** A glanceable tile: the numeral, then a unit. Never a sentence. */
export type GlanceMetric = {
  value: string;
  unit?: string;
};

export type ServiceStatusView = {
  headline: string;
  detail: string;
  /** Label above the estimate, e.g. "Arrival". Null when the estimate stands alone. */
  estimateLabel: string | null;
  /** The live tile. Time counters have no unit. Null at zero. */
  estimate: GlanceMetric | null;
  /** Short marker text for the map: the same number, or "HERE". */
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

function counted(n: number, singular: string, plural: string) {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/** Spoken form of a stacked metric, e.g. "12 seconds". */
export function glanceLabel(metric: GlanceMetric): string {
  if (!metric.unit) {
    const n = Number(metric.value);
    if (Number.isFinite(n)) return counted(n, "second", "seconds");
    return metric.value;
  }
  return `${metric.value} ${metric.unit}`;
}

/**
 * One centered numeral. At most two digits. Floors — a countdown must
 * not jump ahead. Never a unit, never a price.
 */
export function formatTimeCounter(seconds: number): GlanceMetric {
  const total = Math.max(0, Math.min(99, Math.floor(seconds)));
  return { value: String(total) };
}

/** Hide the tile at zero — that count ending *is* the scene change. */
function liveTicker(seconds: number | undefined): GlanceMetric | null {
  if (seconds === undefined) return null;
  const metric = formatTimeCounter(seconds);
  return metric.value === "0" ? null : metric;
}

/** Clock ETA as a two-digit time counter — never "Any moment", never rounded. */
export function formatEtaMetric(seconds: number): GlanceMetric {
  return formatTimeCounter(seconds);
}

/** A clock-style ETA. Used when the user is waiting on someone's arrival. */
export function formatEta(seconds: number): string {
  return glanceLabel(formatEtaMetric(seconds));
}

/** Matching wait: the same two-digit counter, never "Usually under…". */
export function formatTypicalMetric(seconds: number): GlanceMetric {
  return formatTimeCounter(seconds);
}

/** A duration band. Used when the answer is "how long does this usually take". */
export function formatTypical(seconds: number): string {
  return glanceLabel(formatTypicalMetric(seconds));
}

/** Remaining work as a two-digit time counter — never "20 sec remaining". */
export function formatRemainingMetric(seconds: number): GlanceMetric {
  return formatTimeCounter(seconds);
}

/** A remaining-work estimate. Used while work is visibly in progress. */
export function formatRemaining(seconds: number): string {
  return glanceLabel(formatRemainingMetric(seconds));
}

function calloutCount(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return n === 0 ? null : String(n);
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
        estimate: null,
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
        estimate: liveTicker(status.typicalSeconds ?? 60),
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
        estimate: liveTicker(status.etaSeconds),
        callout: calloutCount(status.etaSeconds),
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
        detail: `Your ${l.provider} is heading to you`,
        estimateLabel: "Arriving in",
        estimate: liveTicker(status.etaSeconds),
        callout: calloutCount(status.etaSeconds),
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
        detail: "They're outside",
        estimateLabel: null,
        estimate: null,
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
        estimate: liveTicker(status.remainingSeconds),
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
        estimate: liveTicker(status.remainingSeconds),
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
        estimate: null,
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
        estimate: null,
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
        estimate: null,
        callout: null,
        milestones: track,
        milestoneIndex: 0,
        showProgress: false,
        progress: 0,
        live: false,
      };
  }
}
