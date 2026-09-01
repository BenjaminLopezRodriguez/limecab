"use client";

import type { ReactNode } from "react";

import { LiveSheetHeader } from "@/components/service-app/live-sheet";
import { Progress } from "@/components/ui/progress";
import {
  glanceLabel,
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

/** Dash rail. Current activity above, `_ _ _ _` below. */
export function ServiceMilestones({
  milestones,
  index,
  live = true,
  label,
  className,
}: {
  milestones: readonly string[];
  index: number;
  /** Shimmer the current dash only while the request is live. */
  live?: boolean;
  /** “Doing x”. Defaults to the current milestone. */
  label?: string;
  className?: string;
}) {
  if (milestones.length === 0) return null;

  const last = milestones.length - 1;
  const current = Math.min(Math.max(0, index), last);
  const finished = !live && current >= last;
  const activity = label ?? milestones[current] ?? "";

  return (
    <div className={className}>
      {activity ? (
        <p className="text-muted-foreground mb-2 truncate text-xs">{activity}</p>
      ) : null}
      <ol
        className="flex gap-1.5"
        aria-label={`${activity}, step ${current + 1} of ${milestones.length}`}
      >
        {milestones.map((name, position) => {
          const done = finished || position < current;
          const active = live && position === current && !finished;
          return (
            <li
              key={name}
              className="min-w-0 flex-1"
              aria-current={active ? "step" : undefined}
            >
              <span className="sr-only">{name}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1 w-full rounded-full",
                  done && "bg-foreground",
                  active && "bg-lime service-step-shimmer",
                  !done && !active && "bg-muted-foreground/20",
                )}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * The whole waiting scene, derived from one status value.
 *
 * `actions` is a slot — cancellation, "contact provider", "view receipt" and
 * anything else product-specific belongs to the consuming app, not here.
 */
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

  return (
    <div className={className}>
      <div aria-live="polite">
        <LiveSheetHeader
          instruction={view.headline}
          secondary={view.detail || undefined}
          metric={view.estimate}
          metricAriaLabel={
            view.estimate
              ? view.estimateLabel
                ? `${view.estimateLabel} ${glanceLabel(view.estimate)}`
                : glanceLabel(view.estimate)
              : undefined
          }
        />
      </div>

      {subtitle ? (
        <p className="text-muted-foreground mt-3 truncate text-sm">{subtitle}</p>
      ) : null}

      <ServiceMilestones
        className="mt-3"
        milestones={view.milestones}
        index={view.milestoneIndex}
        live={view.live}
      />

      {error ? (
        <p role="alert" className="text-muted-foreground mt-3 text-sm">
          {error}
        </p>
      ) : null}

      {actions ? <div className="mt-3 flex flex-col gap-2">{actions}</div> : null}
    </div>
  );
}
