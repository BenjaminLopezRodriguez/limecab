"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
 * The presentation ladder maps to snap points, not to different components:
 *   peek       — the trigger and little else, draggable up
 *   sheet      — the default task height
 *   expanded   — opens tall for a long scene (comparison, a list)
 *   fullscreen — the surface is the whole task (prefer `TaskScene` instead)
 */
type SheetPresentation = Exclude<SurfacePresentation, "compact-interrupt">;

/**
 * One continuous set of snap points across every rung, so the ladder is a
 * single draggable object rather than four different drawers. The rung is a
 * *controlled* snap point: the state machine raises and lowers it, and a drag
 * reports back through `onSnapPointChange`. Swapping an uncontrolled
 * `defaultSnapPoint` per rung silently does nothing after first mount.
 */
const PEEK = "12.5rem";
/** Fallback for `sheet` until the scene has been measured. */
const SHEET_FALLBACK = "20rem";
const EXPANDED = 0.88;

const SNAP_FOR: Record<SheetPresentation, string | number> = {
  peek: PEEK,
  sheet: SHEET_FALLBACK,
  expanded: EXPANDED,
  fullscreen: 1,
};

/**
 * `sheet` is the height of the scene it is showing.
 *
 * A fixed rung is wrong in both directions: a two-line status wastes half the
 * screen, and a scene with a primary action puts that action under the fold —
 * the surface looks complete while its only button is unreachable. Measuring
 * keeps the map as large as the task allows and the action always on screen.
 */
function useContentSnap(active: boolean): {
  snapPoint: string | number;
  measure: (node: HTMLElement | null) => void;
} {
  const [height, setHeight] = useState<number | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box) setHeight(box.height);
    });
    observer.observe(node);
    setHeight(node.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [node]);

  const measure = useCallback((next: HTMLElement | null) => setNode(next), []);

  if (!active || height === null) return { snapPoint: SHEET_FALLBACK, measure };
  // Drawer chrome: the swipe handle and the safe-area padding below the scene.
  return { snapPoint: `${Math.round(height + 56)}px`, measure };
}

export function ServiceSheet({
  children,
  className,
  label = "Your request",
  description = "Drag to resize.",
  presentation = "sheet",
}: {
  children: ReactNode;
  className?: string;
  /** Accessible name; the visible heading lives in `children`. */
  label?: string;
  description?: string;
  presentation?: SheetPresentation;
}) {
  const isMobile = useServiceAppMobile();
  const surface = useOptionalAdaptiveSurface();
  const interrupted = surface?.interrupted ?? false;
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  const busy = surface?.progress.locked ? true : undefined;
  const { snapPoint: contentSnap, measure } = useContentSnap(
    presentation === "sheet",
  );
  const rung = presentation === "sheet" ? contentSnap : SNAP_FOR[presentation];
  const [snap, setSnap] = useState<string | number | null>(rung);
  // A measured rung must stay reachable: the ladder is peek → this → tall.
  const snapPoints = useMemo<(string | number)[]>(
    () => [PEEK, rung, EXPANDED, 1].filter((v, i, all) => all.indexOf(v) === i),
    [rung],
  );

  // The rung follows the scene; a drag then moves it from wherever it is.
  useEffect(() => {
    setSnap(rung);
  }, [rung]);

  if (!isMobile) {
    return (
      <div
        className={cn(
          "bg-card text-card-foreground border-border max-h-full min-h-0 overflow-y-auto rounded-3xl border shadow-lg",
          className,
        )}
      >
        <div ref={surface?.registerPanel} className="p-6" aria-busy={busy}>
          {children}
        </div>
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
      snapPoints={snapPoints}
      snapPoint={snap}
      onSnapPointChange={setSnap}
    >
      <DrawerContent
        data-presentation={presentation}
        className={cn(
          // An interruption recedes the parent instead of unmounting it, so
          // the suspended scene stays visible behind the compact sheet.
          interrupted && "opacity-55 brightness-95",
          className,
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        <DrawerDescription className="sr-only">{description}</DrawerDescription>
        {/* Scroll container must be a flex item — `h-full` does not resolve
            inside a content-sized drawer. */}
        <div
          ref={surface?.registerPanel}
          className="min-h-0 flex-1 overflow-y-auto px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
          aria-busy={busy}
        >
          {/* Measured here, not on the scroller: the scroller's height is set
              by the rung, so measuring it feeds the rung back into itself. */}
          <div ref={measure}>{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** The sheet is chrome, not a dialog — it cannot be dismissed by gesture. */
function keepOpen(open: boolean) {
  void open;
}
