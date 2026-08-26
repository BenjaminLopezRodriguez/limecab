"use client";

import type { KeyboardEvent, ReactNode } from "react";

import {
  AdaptiveSurface,
  useOptionalAdaptiveSurface,
} from "@/components/service-app/adaptive-surface";
import { cn } from "@/lib/utils";

/**
 * ServiceAppShell — the canvas + surface frame.
 *
 * On a phone, `layout="home"` is a column: a rounded map card above, then the
 * launcher (Where to?, places). The map is a sibling, not a full-bleed canvas
 * clipped by an overlay sheet — so the rounded region is actually visible.
 *
 * `layout="task"` keeps the map as the full canvas with the sheet floating
 * over it from the thumb zone.
 *
 * On a desktop `layout="home"` becomes a two-column launcher: controls left,
 * a large map right. Same state, different composition.
 *
 * The map and the children stay mounted across that change, so map camera and
 * draft state survive the transition.
 *
 * Height: the shell fills the viewport minus `--service-app-chrome`. Set that
 * variable on an ancestor if your app has a header or bottom nav:
 *   <div style={{ "--service-app-chrome": "7rem" }}>
 */
const SHELL_H = "h-[calc(100dvh-var(--service-app-chrome,0px))]";
const SHELL_H_MD = "md:h-[calc(100dvh-var(--service-app-chrome,0px))]";

export function ServiceAppShell({
  map,
  layout = "task",
  onMapPress,
  className,
  children,
}: {
  map: ReactNode;
  layout?: "home" | "task";
  /** Home map card: tapping adjusts pickup (or starts the spatial task). */
  onMapPress?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdaptiveSurface.Root>
      <ShellBody
        layout={layout}
        map={map}
        onMapPress={onMapPress}
        className={className}
      >
        {children}
      </ShellBody>
    </AdaptiveSurface.Root>
  );
}

function ShellBody({
  layout,
  map,
  onMapPress,
  className,
  children,
}: {
  layout: "home" | "task";
  map: ReactNode;
  onMapPress?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const home = layout === "home";
  const surface = useOptionalAdaptiveSurface();
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  // Home map is tappable on every width — it is the pickup affordance.
  const mapPress = home ? onMapPress : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden",
        SHELL_H,
        // Desktop home: controls left, larger map right. Same state,
        // different composition — no second state machine.
        home &&
          cn(
            "md:grid md:min-h-0 md:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] md:overflow-visible",
            SHELL_H_MD,
          ),
        className,
      )}
    >
      <MapSlot home={home} onPress={mapPress}>
        {map}
      </MapSlot>
      <div
        className={cn(
          home
            ? cn(
                // Home launcher sits below the map card on mobile — a sibling,
                // not an overlay that clips the rounded map.
                "bg-card border-border relative z-10 shrink-0",
                "overflow-y-auto rounded-t-3xl border-t px-5 pt-4",
                "pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg",
                "md:col-start-1 md:row-start-1 md:mt-0 md:max-h-none md:flex md:flex-1",
                "md:flex-col md:rounded-none md:border-0 md:px-6 md:py-6 md:shadow-none",
                // Cap height so a long recent list does not eat the map card.
                "max-h-[min(52%,28rem)] md:max-h-none",
              )
            : "relative z-10 mt-auto md:pointer-events-none md:absolute md:inset-0 md:mt-0 md:flex md:justify-end md:p-6",
          !home && !sheetOpen && "md:hidden",
        )}
      >
        <div
          className={cn(
            !home &&
              "md:pointer-events-auto md:flex md:h-fit md:max-h-full md:min-h-0 md:w-[min(100%,24rem)] md:flex-col",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function MapSlot({
  home,
  onPress,
  children,
}: {
  home: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onPress) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onPress();
    }
  };

  return (
    <div
      className={cn(
        home
          ? // Home: flex sibling with padding so the rounded card is visible.
            "relative min-h-[12rem] flex-1 p-4 pb-2 md:col-start-2 md:row-start-1 md:h-full md:min-h-0 md:p-6 md:pl-0"
          : "absolute inset-0 md:inset-6",
      )}
    >
      <div
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={onPress ? onKeyDown : undefined}
        aria-label={onPress ? "Adjust pickup on map" : undefined}
        className={cn(
          "size-full overflow-hidden",
          // Rounded map card on home at every width; task canvas stays square
          // on mobile and rounds only in the desktop inset.
          home
            ? "ring-border rounded-3xl ring-1 md:min-h-[22rem]"
            : "ring-border md:rounded-3xl md:ring-1",
          onPress &&
            "focus-visible:ring-ring cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}
