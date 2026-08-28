"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  useOptionalAdaptiveSurface,
  type SurfacePresentation,
} from "@/components/service-app/adaptive-surface";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { publishSheetSnap } from "@/components/service-app/map-overlay";
import { useServiceAppMobile } from "@/hooks/use-service-app-mobile";
import { cn } from "@/lib/utils";

/**
 * The task surface. Identical scene content at every width — AdaptiveSurface
 * chooses the presentation.
 *
 * Mobile: a drag-to-resize bottom drawer that is *chrome*, not a dialog.
 * `modal={false}` keeps the canvas behind it interactive and
 * `disablePointerDismissal` keeps it from ever closing; the state machine
 * decides what it shows, not a swipe.
 *
 * Desktop: a floating card inside `AdaptiveSurface.Panel`, over the canvas.
 *
 * The ladder is fractions of the screen, never the scene's content height —
 * measuring made comparison and status scenes swallow the map.
 *   peek       — a status strip; canvas is the subject
 *   sheet      — 40%
 *   expanded   — 60%
 * `overlay` snaps the same drawer to the viewport. `TaskScene` (`fullscreen`)
 * is a different chrome — a dialog, not a snap.
 *
 * A snap drawer is 100dvh tall and translated down, so only its top slice is
 * on screen. The body is sized to that slice *in CSS*, from the drawer's own
 * `--drawer-snap-point-offset` — no `getBoundingClientRect`, no ResizeObserver,
 * and no portal. `SheetActions` is then an ordinary sticky footer inside the
 * scrollport, which is why it can appear and disappear (progressive
 * disclosure) without ever resizing the map.
 */
type SheetPresentation = Exclude<SurfacePresentation, "compact-interrupt">;

const PEEK = 0.22;
const SHEET = 0.4;
const EXPANDED = 0.6;
const OVERLAY = 1;

const SNAP_FOR: Record<SheetPresentation, number> = {
  peek: PEEK,
  sheet: SHEET,
  expanded: EXPANDED,
  fullscreen: EXPANDED,
  overlay: OVERLAY,
};

const SNAP_POINTS = [PEEK, SHEET, EXPANDED];
const OVERLAY_POINTS = [OVERLAY];

export { EXPANDED as SHEET_EXPANDED_SNAP };

const DESKTOP_MAX: Record<SheetPresentation, string> = {
  peek: "md:max-h-[22dvh]",
  sheet: "md:max-h-[40dvh]",
  expanded: "md:max-h-[60dvh]",
  fullscreen: "md:max-h-[60dvh]",
  overlay: "md:h-full md:max-h-full",
};

/** Swipe handle (h-3) plus the popup's top border. */
const SHEET_CHROME_PX = 13;

/**
 * Constrained thumb-zone for a scene: one primary action, optionally a
 * payment ribbon. Omit the component until there is something to confirm — it
 * then sits at the bottom of the visible sheet (`mt-auto`) and sticks there
 * once the body scrolls. Cap is a ribbon + a button, not a second sheet.
 */
export function SheetActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // `shrink-0`: it is a flex item in the scrolling column, and its own
        // `overflow-y-auto` would otherwise let it be squashed to nothing.
        "bg-card/95 border-border sticky bottom-0 z-10 -mx-5 mt-auto flex max-h-[9.5rem] shrink-0 flex-col gap-1 overflow-y-auto border-t px-5 pt-2.5 backdrop-blur-sm md:-mx-6 md:px-6",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-3",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ServiceSheet({
  children,
  className,
  label = "Your request",
  description = "Drag to resize.",
  presentation = "sheet",
  onSnapChange,
}: {
  children: ReactNode;
  className?: string;
  /** Accessible name; the visible heading lives in `children`. */
  label?: string;
  description?: string;
  presentation?: SheetPresentation;
  /** Fired when the mobile drawer snaps to a new rung. */
  onSnapChange?: (snap: number) => void;
}) {
  const isMobile = useServiceAppMobile();
  const surface = useOptionalAdaptiveSurface();
  const interrupted = surface?.interrupted ?? false;
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  const busy = surface?.progress.locked ? true : undefined;
  const rung = SNAP_FOR[presentation];
  const [snap, setSnap] = useState<string | number | null>(rung);

  useEffect(() => {
    setSnap(rung);
  }, [rung]);

  // The map gets the rung, not the drawer's geometry. One event per snap.
  useEffect(() => {
    if (!sheetOpen) return publishSheetSnap(null);
    return publishSheetSnap(typeof snap === "number" ? snap : rung);
  }, [rung, sheetOpen, snap]);

  /**
   * The rung the drawer is on, as a fraction of the viewport — the same number
   * the map gets. The drawer is taller than the screen and translated down, so
   * this *is* the height of the slice on screen: sizing the body from the known
   * fraction is exact, and needs no geometry from the translating popup.
   */
  const fraction = typeof snap === "number" ? snap : rung;

  const body = (
    <div
      style={
        isMobile
          ? { height: `calc(${fraction} * 100dvh - ${SHEET_CHROME_PX}px)` }
          : undefined
      }
      className={cn(
        "flex flex-col overflow-hidden",
        !isMobile && "min-h-0 flex-1",
      )}
    >
      <div
        ref={surface?.registerPanel}
        data-sheet-scroll=""
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto",
          isMobile ? "px-5 pt-1" : "px-6 pt-6",
        )}
        aria-busy={busy}
      >
        {children}
      </div>
    </div>
  );

  if (!isMobile) {
    return (
      <div
        className={cn(
          "bg-card text-card-foreground border-border flex min-h-0 flex-col overflow-hidden rounded-3xl border shadow-lg",
          DESKTOP_MAX[presentation],
          className,
        )}
      >
        {body}
      </div>
    );
  }

  return (
    <Drawer
      open={sheetOpen}
      onOpenChange={keepOpen}
      modal={false}
      disablePointerDismissal
      showSwipeHandle
      swipeDirection="down"
      snapPoints={presentation === "overlay" ? OVERLAY_POINTS : SNAP_POINTS}
      snapPoint={snap}
      onSnapPointChange={(value) => {
        setSnap(value);
        const next = typeof value === "number" ? value : rung;
        onSnapChange?.(next);
      }}
    >
      <DrawerContent
        data-presentation={presentation}
        className={cn(
          interrupted && "opacity-55 brightness-95",
          className,
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        {body}
      </DrawerContent>
    </Drawer>
  );
}

/** The sheet is chrome, not a dialog — it cannot be dismissed by gesture. */
function keepOpen(open: boolean) {
  void open;
}
