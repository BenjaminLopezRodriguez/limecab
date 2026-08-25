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
  className,
}: {
  label?: string | null;
  value: string;
  className?: string;
}) {
  return (
    <p className={cn("text-sm", className)}>
      {label ? (
        <span className="text-muted-foreground block">{label}</span>
      ) : null}
      <span className="text-[17px] font-medium tracking-tight tabular-nums">
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

      {view.detail ? (
        <p className="mt-2 text-[15px] leading-relaxed">{view.detail}</p>
      ) : null}

      {view.estimate ? (
        <ProviderEta
          className="mt-4"
          label={view.estimateLabel}
          value={view.estimate}
        />
      ) : null}

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
