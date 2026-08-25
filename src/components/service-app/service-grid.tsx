"use client";

import type { ServiceDefinition } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * "What service?" — the product launcher.
 *
 * The app supplies the services, including their icons. This component never
 * inspects an id, so it carries no business semantics.
 *
 * Unavailable services stay visible but are not silently inert: selecting one
 * still calls `onSelect`, and the app answers with an interruption explaining
 * why. Disabled controls that do nothing are a dead end.
 *
 * Two presentations, one component. `variant="grid"` is the consumer launcher
 * — large tap targets, a catalogue you can take in at a glance. Past roughly
 * six services that stops scanning, so `variant="list"` gives a dense row per
 * service instead. The choice is a layout call, not a different primitive.
 */
export function ServiceGrid({
  services,
  onSelect,
  columns = 2,
  variant = "grid",
  selectedId,
  className,
  unavailableLabel = "Coming soon",
}: {
  services: ServiceDefinition[];
  onSelect: (service: ServiceDefinition) => void;
  columns?: 1 | 2 | 3;
  /** "list" is the dense presentation for catalogues longer than ~6. */
  variant?: "grid" | "list";
  /** Marks the current choice when returning to this scene. */
  selectedId?: string | null;
  className?: string;
  unavailableLabel?: string;
}) {
  if (variant === "list") {
    return (
      <ul className={cn("divide-border ring-border divide-y rounded-2xl ring-1", className)}>
        {services.map((service) => {
          const available = service.status === "available";
          const selected = selectedId === service.id;
          return (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => onSelect(service)}
                aria-pressed={selected}
                aria-label={describe(service, unavailableLabel)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  "first:rounded-t-2xl last:rounded-b-2xl",
                  selected ? "bg-accent" : "active:bg-accent",
                  available ? "" : "text-muted-foreground",
                )}
              >
                {service.icon ? (
                  <span aria-hidden="true" className="shrink-0 [&_svg]:size-5">
                    {service.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="text-foreground block truncate text-[15px] font-medium tracking-tight">
                    {service.title}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm leading-snug">
                    {available ? service.description : unavailableLabel}
                  </span>
                </span>
                {available && service.meta ? (
                  <span className="shrink-0 text-right">
                    {service.meta.value ? (
                      <span className="text-foreground block text-[15px] font-medium tabular-nums">
                        {service.meta.value}
                      </span>
                    ) : null}
                    {service.meta.note ? (
                      <span className="text-muted-foreground block text-xs tabular-nums">
                        {service.meta.note}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  const grid =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : "grid-cols-2";

  return (
    <ul className={cn("grid gap-3", grid, className)}>
      {services.map((service) => {
        const available = service.status === "available";
        const selected = selectedId === service.id;
        return (
          <li key={service.id}>
            <button
              type="button"
              onClick={() => onSelect(service)}
              aria-pressed={selected}
              aria-label={describe(service, unavailableLabel)}
              className={cn(
                "bg-card ring-border flex min-h-[7.5rem] w-full flex-col items-start rounded-3xl px-4 py-4 text-left ring-1",
                "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                selected && "ring-ring bg-accent ring-2",
                available
                  ? "hover:ring-ring/40 active:bg-accent"
                  : "text-muted-foreground",
              )}
            >
              {service.icon ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "[&_svg]:size-6",
                    available ? "" : "text-muted-foreground",
                  )}
                >
                  {service.icon}
                </span>
              ) : null}
              <span className="text-foreground mt-3 text-[17px] font-medium tracking-tight text-pretty">
                {service.title}
              </span>
              <span className="text-muted-foreground mt-0.5 text-sm leading-snug">
                {available ? service.description : unavailableLabel}
              </span>
              {available && service.meta ? (
                <span className="mt-auto flex w-full items-baseline justify-between gap-2 pt-3">
                  <span className="text-muted-foreground truncate text-xs tabular-nums">
                    {service.meta.note}
                  </span>
                  <span className="text-foreground shrink-0 text-[15px] font-medium tabular-nums">
                    {service.meta.value}
                  </span>
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** One spoken sentence per option, metrics included — comparison shopping
 *  works with a screen reader or it does not work. */
function describe(service: ServiceDefinition, unavailableLabel: string): string {
  if (service.status !== "available") {
    return `${service.title}. ${unavailableLabel}.`;
  }
  const meta = [service.meta?.value, service.meta?.note]
    .filter(Boolean)
    .join(". ");
  return `${service.title}. ${service.description}.${meta ? ` ${meta}.` : ""}`;
}
