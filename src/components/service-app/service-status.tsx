"use client";

import type { ReactNode } from "react";

import { Progress } from "@/components/ui/progress";
import {
  serviceStatusView,
  type ServiceStatus,
  type StatusLabels,
} from "@/lib/service-app/status";
import { cn } from "@/lib/utils";

/**
 * Waiting states.
 *
 * There is no generic spinner here on purpose. `ServiceStatusPanel` renders
 * the metric that answers the question the user is actually asking right now
 * — see `lib/service-app/status.ts`.
 */

/** A clock-style ETA. Use while waiting on someone's arrival. */
export function ProviderEta({
  label,
  value,
  hero = false,
  className,
}: {
  label?: string | null;
  value: string;
  /** The metric is the answer to the scene's question — size it like one. */
  hero?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("text-sm", className)}>
      {label ? (
        <span className="text-muted-foreground block text-[11px] tracking-[0.12em] uppercase">
          {label}
        </span>
      ) : null}
      <span
        className={cn(
          "block tabular-nums",
          hero
            ? "text-[34px] leading-none font-semibold tracking-[-0.03em]"
            : "text-[17px] font-medium tracking-tight",
        )}
      >
        {value}
      </span>
    </p>
  );
}

/** Step-of-N progress. Use while work is visibly in progress. */
export function ServiceProgress({
  value,
  completedSteps,
  totalSteps,
  className,
}: {
  /** 0–100. */
  value: number;
  completedSteps?: number;
  totalSteps?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {completedSteps !== undefined && totalSteps !== undefined ? (
        <p className="text-muted-foreground mb-2 text-xs tabular-nums">
          {completedSteps} of {totalSteps} steps complete
        </p>
      ) : null}
      <Progress value={value} aria-label="Service progress" />
    </div>
  );
}

/** Milestone rail. Shows *where* in the lifecycle the request is. */
export function ServiceMilestones({
  milestones,
  index,
  className,
}: {
  milestones: readonly string[];
  index: number;
  className?: string;
}) {
  if (milestones.length === 0) return null;
  return (
    <ol className={cn("flex justify-between gap-1", className)}>
      {milestones.map((label, position) => {
        const done = position <= index;
        return (
          <li
            key={label}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                done ? "bg-foreground" : "bg-muted-foreground/30",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "w-full truncate text-center text-[10px]",
                done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The whole waiting scene, derived from one status value.
 *
 * `actions` is a slot — cancellation, "contact provider", "view receipt" and
 * anything else product-specific belongs to the consuming app, not here.
 */
/** States whose estimate is a duration band or a phrase, not a live metric. */
const BAND_STATES = new Set<ServiceStatus["state"]>([
  "pending",
  "matching",
  "completing",
  "complete",
  "cancelled",
  "failed",
]);

export function ServiceStatusPanel({
  status,
  labels,
  subtitle,
  actions,
  error,
  className,
}: {
  status: ServiceStatus;
  labels?: Partial<StatusLabels>;
  /** Secondary line, usually the service name and address. */
  subtitle?: string;
  actions?: ReactNode;
  error?: string | null;
  className?: string;
}) {
  const view = serviceStatusView(status, labels);
  // A band ("usually under a minute") is not an answer; an arrival time or a
  // remaining time is. Only the answer gets hero weight.
  const hero = !BAND_STATES.has(status.state);

  return (
    <div className={className}>
      {/* One live region for the whole answer: the headline and the metric
          change together, and both are minute-granular. */}
      <div aria-live="polite">
        <p className="flex items-center gap-2 text-[17px] leading-snug font-medium tracking-tight">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              view.live ? "bg-foreground" : "bg-muted-foreground/40",
            )}
            aria-hidden="true"
          />
          {view.headline}
        </p>

        {view.estimate ? (
          <ProviderEta
            className={hero ? "mt-3" : "mt-2"}
            label={view.estimateLabel}
            value={view.estimate}
            hero={hero}
          />
        ) : null}

        {view.detail ? (
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">
            {view.detail}
          </p>
        ) : null}
      </div>

      {subtitle ? (
        <p className="text-muted-foreground mt-4 truncate text-sm">{subtitle}</p>
      ) : null}

      {view.showProgress ? (
        <ServiceProgress
          className="mt-5"
          value={view.progress}
          completedSteps={
            status.state === "active" ? status.completedSteps : undefined
          }
          totalSteps={
            status.state === "active" ? status.totalSteps : undefined
          }
        />
      ) : null}

      <ServiceMilestones
        className="mt-5"
        milestones={view.milestones}
        index={view.milestoneIndex}
      />

      {error ? (
        <p role="alert" className="text-muted-foreground mt-4 text-sm">
          {error}
        </p>
      ) : null}

      {actions ? <div className="mt-5 flex flex-col gap-3">{actions}</div> : null}
    </div>
  );
}
