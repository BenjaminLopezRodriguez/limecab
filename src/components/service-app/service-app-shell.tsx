"use client";

import type { KeyboardEvent, ReactNode } from "react";

import {
  AdaptiveSurface,
  useOptionalAdaptiveSurface,
} from "@/components/service-app/adaptive-surface";
import { useServiceAppMobile } from "@/hooks/use-service-app-mobile";
import { cn } from "@/lib/utils";

/**
 * ServiceAppShell — the canvas + surface frame.
 *
 * On a phone the map is always the canvas and the content floats over it —
 * the spatial question ("where am I, where is my car") is the screen, and a
 * surface answers it from the thumb zone. `layout="home"` differs from
 * `layout="task"` only in that its panel is anchored (a launcher that can be
 * scrolled) rather than owned by the surface ladder.
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
  /** Mobile home only: tapping the bounded map starts the spatial task. */
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
  const isMobile = useServiceAppMobile();
  const surface = useOptionalAdaptiveSurface();
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  const mapPress = home && isMobile ? onMapPress : undefined;

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
                // The launcher floats over the canvas from the thumb zone and
                // scrolls inside itself, so the map is never a postage stamp.
                "bg-background border-border relative z-10 mt-auto max-h-[72%] shrink-0",
                "overflow-y-auto rounded-t-3xl border-t px-5 pt-4",
                "pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg",
                "md:col-start-1 md:row-start-1 md:mt-0 md:max-h-none md:flex md:flex-1",
                "md:flex-col md:rounded-none md:border-0 md:px-6 md:py-6 md:shadow-none",
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
          ? "absolute inset-0 md:relative md:col-start-2 md:row-start-1 md:h-full md:min-h-0 md:p-6 md:pl-0"
          : "absolute inset-0 md:inset-6",
      )}
    >
      <div
        role={onPress ? "button" : undefined}
        tabIndex={onPress ? 0 : undefined}
        onClick={onPress}
        onKeyDown={onPress ? onKeyDown : undefined}
        aria-label={onPress ? "Choose a location" : undefined}
        className={cn(
          "ring-border size-full overflow-hidden md:rounded-3xl md:ring-1",
          home && "md:min-h-[22rem]",
          onPress &&
            "focus-visible:ring-ring cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:pointer-events-none md:cursor-default",
        )}
      >
        {children}
      </div>
    </div>
  );
}
