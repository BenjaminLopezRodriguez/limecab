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
 * launcher (Where to?, places) on the same paper. No fake sheet chrome — the
 * map is a sibling, not a canvas clipped by an overlay.
 *
 * `layout="task"` keeps the map as the full canvas with the sheet floating
 * over it from the thumb zone. The canvas runs *under* the sheet — it is never
 * inset to sit above it, because that resizes Mapbox on every snap.
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
  header,
  onMapPress,
  mapPressLabel,
  className,
  children,
}: {
  map: ReactNode;
  layout?: "home" | "task";
  /**
   * Home layout only: content *above* the map card — a headline, a status
   * pair, top-trailing controls. Some launchers open with a question rather
   * than with the canvas, and that order is the composition. Ignored in
   * `task`, where the canvas is the whole screen.
   */
  header?: ReactNode;
  /** Home map card: tapping adjusts pickup (or starts the spatial task). */
  onMapPress?: () => void;
  /** What that tap does, for a screen reader. */
  mapPressLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <AdaptiveSurface.Root>
      <ShellBody
        layout={layout}
        map={map}
        header={header}
        onMapPress={onMapPress}
        mapPressLabel={mapPressLabel}
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
  header,
  onMapPress,
  mapPressLabel,
  className,
  children,
}: {
  layout: "home" | "task";
  map: ReactNode;
  header?: ReactNode;
  onMapPress?: () => void;
  mapPressLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  const home = layout === "home";
  // A header adds a row above the launcher column on desktop; without one the
  // grid is exactly what it was.
  const headed = home && Boolean(header);
  const surface = useOptionalAdaptiveSurface();
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  // Home map is tappable on every width — it is the pickup affordance.
  const mapPress = home ? onMapPress : undefined;

  return (
    <div
      data-service-app-shell=""
      className={cn(
        "relative flex flex-col",
        SHELL_H,
        !home && "overflow-hidden",
        // Desktop home: controls left, larger map right. Same state,
        // different composition — no second state machine.
        home &&
          cn(
            "overflow-y-auto md:grid md:min-h-0 md:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)] md:overflow-hidden",
            headed && "md:grid-rows-[auto_minmax(0,1fr)]",
            SHELL_H_MD,
          ),
        className,
      )}
    >
      {headed ? (
        <div className="relative z-10 shrink-0 px-5 md:col-start-1 md:row-start-1 md:px-6 md:pt-6">
          {header}
        </div>
      ) : null}
      <MapSlot
        home={home}
        onPress={mapPress}
        pressLabel={mapPressLabel}
        spanRows={headed}
      >
        {map}
      </MapSlot>
      <div
        className={cn(
          home
            ? cn(
                // Same paper as the map card — not a raised sheet overlay.
                "relative z-10 shrink-0",
                "px-5 pt-3",
                "pb-[var(--nav-pill-clear,8rem)]",
                headed ? "md:row-start-2" : "md:row-start-1",
                "md:col-start-1 md:mt-0 md:flex md:h-full md:min-h-0 md:flex-1",
                "md:flex-col md:overflow-y-auto md:px-6 md:pt-6 md:pb-[var(--nav-pill-clear,8rem)]",
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
  pressLabel,
  spanRows = false,
  children,
}: {
  home: boolean;
  onPress?: () => void;
  pressLabel?: string;
  spanRows?: boolean;
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
          ? // Home: a map region on the same paper, not a leftover behind a sheet.
            cn(
              "relative h-[min(34dvh,20rem)] shrink-0 p-4 pb-2 md:col-start-2 md:row-start-1 md:h-full md:min-h-0 md:flex-1 md:p-6 md:pl-0",
              spanRows && "md:row-span-2",
            )
          : // Task: the map is the background, full bleed. The sheet floats
            // over it; camera padding — not a resized box — keeps the route in
            // the gap. Nothing here moves when the sheet snaps.
            "absolute inset-0 md:inset-6",
      )}
    >
      <div
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={onPress ? onKeyDown : undefined}
        aria-label={onPress ? (pressLabel ?? "Adjust pickup on map") : undefined}
        className={cn(
          "size-full overflow-hidden",
          // Home: a rounded map card on the same paper. Task: a square canvas
          // — do not round the map to match the sheet.
          home
            ? "ring-border rounded-3xl ring-1 md:min-h-[22rem]"
            : "md:ring-border md:ring-1",
          onPress &&
            "focus-visible:ring-ring cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        {children}
      </div>
    </div>
  );
}
