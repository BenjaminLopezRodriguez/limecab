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
 * `layout="home"` is a product launcher: a *bounded* map region above a
 * scrolling column of controls. `layout="task"` promotes the map to the full
 * canvas with the surface floating over it, because the spatial task has
 * become primary.
 *
 * The map and the children stay mounted across that change, so map camera and
 * draft state survive the transition.
 *
 * Height: the shell fills the viewport minus `--service-app-chrome`. Set that
 * variable on an ancestor if your app has a header or bottom nav:
 *   <div style={{ "--service-app-chrome": "7rem" }}>
 */
const SHELL_H = "h-[calc(100dvh-var(--service-app-chrome,0px))]";
const SHELL_MIN_H = "min-h-[calc(100dvh-var(--service-app-chrome,0px))]";
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
        home
          ? cn(
              "flex flex-col",
              SHELL_MIN_H,
              // Desktop home: controls left, larger map right. Same state,
              // different composition — no second state machine.
              "md:grid md:min-h-0 md:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]",
              SHELL_H_MD,
            )
          : cn("relative flex flex-col overflow-hidden", SHELL_H),
        className,
      )}
    >
      <MapSlot home={home} onPress={mapPress}>
        {map}
      </MapSlot>
      <div
        className={cn(
          home
            ? "flex flex-1 flex-col px-5 pt-5 pb-6 md:col-start-1 md:row-start-1 md:overflow-y-auto md:px-6 md:py-6"
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
          ? "px-5 pt-4 md:col-start-2 md:row-start-1 md:h-full md:min-h-0 md:p-6 md:pl-0"
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
          "ring-border overflow-hidden ring-1",
          home
            ? "h-52 rounded-3xl md:h-full md:min-h-[22rem]"
            : "size-full md:rounded-3xl",
          onPress &&
            "focus-visible:ring-ring cursor-pointer touch-manipulation focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none md:pointer-events-none md:cursor-default",
        )}
      >
        {children}
      </div>
    </div>
  );
}
