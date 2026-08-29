"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

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
import {
  SHEET_DISMISS_SNAP,
  SHEET_EXPANDED_SNAP,
  SHEET_OVERLAY_SNAP,
  SHEET_PEEK_SNAP,
  SHEET_SNAP,
  sheetContentOverflows,
  sheetInnerScrolls,
  sheetSnapPoints,
} from "@/lib/service-app/sheet-interaction";
import { cn } from "@/lib/utils";

/**
 * The task surface. Identical scene content at every width — AdaptiveSurface
 * chooses the presentation.
 *
 * Mobile: a drag-to-resize bottom drawer that is *chrome*, not a dialog.
 * `modal={false}` keeps the canvas behind it interactive and
 * `disablePointerDismissal` keeps a tap on the canvas from closing it.
 * Snap points resize it. A consumer that passes `onDismiss` adds a 0 snap:
 * dragging all the way down leaves the task — Home for a draft, the live
 * pill for a running service. Without `onDismiss`, swipe never closes it.
 *
 * Desktop: a floating card inside `AdaptiveSurface.Panel`, over the canvas.
 *
 * Rest rungs are fractions of the screen, never the scene's content height —
 * measuring made comparison and status scenes swallow the map.
 *   peek       — a status strip; canvas is the subject
 *   sheet      — 40%
 *   expanded   — 60%
 * Overlay is the overflow destination of this same drawer: if the scene does
 * not fit, a scroll/swipe grows it toward the viewport. Inner scrolling stays
 * locked until overlay so that gesture is the expansion, not a clipped list.
 * `TaskScene` (`fullscreen`) is a different chrome — a dialog, not a snap.
 *
 * A snap drawer is 100dvh tall and translated down, so only its top slice is
 * on screen. The popup's padding-bottom is the off-screen remainder plus the
 * live swipe, sized from the known snap fraction — no `getBoundingClientRect`,
 * no ResizeObserver on the translating popup, and no portal. `SheetActions`
 * is then an ordinary sticky footer inside the scrollport, which is why it
 * can appear and disappear (progressive disclosure) without ever resizing
 * the map.
 */
type SheetPresentation = Exclude<SurfacePresentation, "compact-interrupt">;

const SNAP_FOR: Record<SheetPresentation, number> = {
  peek: SHEET_PEEK_SNAP,
  sheet: SHEET_SNAP,
  expanded: SHEET_EXPANDED_SNAP,
  fullscreen: SHEET_EXPANDED_SNAP,
  overlay: SHEET_OVERLAY_SNAP,
};

export { SHEET_EXPANDED_SNAP, SHEET_OVERLAY_SNAP };

const DESKTOP_MAX: Record<SheetPresentation, string> = {
  peek: "md:max-h-[22dvh]",
  sheet: "md:max-h-[40dvh]",
  expanded: "md:max-h-[60dvh]",
  fullscreen: "md:max-h-[60dvh]",
  overlay: "md:h-full md:max-h-full",
};

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
  overlaySnap = false,
  onSnapChange,
  onDismiss,
}: {
  children: ReactNode;
  className?: string;
  /** Accessible name; the visible heading lives in `children`. */
  label?: string;
  description?: string;
  presentation?: SheetPresentation;
  /**
   * Listed sheets: overlay is reachable even before overflow is measured.
   * Overflowing scenes get the same top snap without this flag.
   */
  overlaySnap?: boolean;
  /** Fired when the mobile drawer snaps to a new rung. */
  onSnapChange?: (snap: number) => void;
  /**
   * Dragging past peek (snap 0) or otherwise closing the drawer. Omit it
   * and the sheet cannot close — driver idle peeks, pin confirms.
   */
  onDismiss?: () => void;
}) {
  const isMobile = useServiceAppMobile();
  const surface = useOptionalAdaptiveSurface();
  const interrupted = surface?.interrupted ?? false;
  const sheetOpen = surface?.progress.sheetOpen ?? true;
  const busy = surface?.progress.locked ? true : undefined;
  const rung = SNAP_FOR[presentation];
  const [snap, setSnap] = useState<string | number | null>(rung);
  const [overflows, setOverflows] = useState(overlaySnap);
  const scrollRef = useRef<HTMLDivElement>(null);

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
   * this *is* the height of the slice on screen.
   */
  const fraction = typeof snap === "number" ? snap : rung;
  const innerScrolls = sheetInnerScrolls(fraction);
  const overlayReachable =
    overlaySnap || presentation === "overlay" || overflows || innerScrolls;
  const snapPoints = sheetSnapPoints({
    presentation,
    overlay: overlayReachable,
    dismiss: Boolean(onDismiss),
  });
  const registerPanel = surface?.registerPanel;
  const setScrollNode = useCallback(
    (node: HTMLDivElement | null) => {
      scrollRef.current = node;
      registerPanel?.(node);
    },
    [registerPanel],
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => {
      setOverflows(sheetContentOverflows(el.scrollHeight, el.clientHeight));
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    for (const child of el.children) {
      if (child instanceof Element) observer.observe(child);
    }
    return () => observer.disconnect();
  }, [children, fraction, sheetOpen]);

  const body = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        ref={setScrollNode}
        data-sheet-scroll=""
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          innerScrolls ? "overflow-y-auto" : "overflow-hidden",
          isMobile ? "px-5 pt-1" : "px-6 pt-6",
        )}
        aria-busy={busy}
        onWheel={(event) => {
          if (innerScrolls) {
            if (event.currentTarget.scrollTop <= 0 && event.deltaY < 0) {
              setSnap(SHEET_EXPANDED_SNAP);
              onSnapChange?.(SHEET_EXPANDED_SNAP);
            }
            return;
          }
          if (!overlayReachable || event.deltaY <= 0) return;
          setSnap(SHEET_OVERLAY_SNAP);
          onSnapChange?.(SHEET_OVERLAY_SNAP);
        }}
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
          overlaySnap || presentation === "overlay" || innerScrolls
            ? "md:h-full md:max-h-full"
            : DESKTOP_MAX[presentation],
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
      onOpenChange={(open) => {
        if (!open) onDismiss?.();
      }}
      modal={false}
      disablePointerDismissal
      showSwipeHandle
      swipeDirection="down"
      snapPoints={snapPoints}
      snapPoint={snap}
      onSnapPointChange={(value) => {
        setSnap(value);
        const next = typeof value === "number" ? value : rung;
        if (onDismiss && next === SHEET_DISMISS_SNAP) {
          onDismiss();
          return;
        }
        onSnapChange?.(next);
      }}
    >
      <DrawerContent
        data-presentation={presentation}
        style={
          {
            "--sheet-rest-inset": `${(1 - fraction) * 100}dvh`,
          } as CSSProperties
        }
        className={cn(
          interrupted && "opacity-55 brightness-95",
          "[--drawer-content-max-height:100dvh]",
          "pb-[max(0px,calc(var(--sheet-rest-inset)+var(--drawer-swipe-movement-y,0px)))]",
          presentation === "overlay" &&
            "data-[swipe-direction=down]:rounded-none",
          className,
        )}
      >
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        <DrawerDescription className="sr-only">
          {onDismiss
            ? "Drag to resize. Drag all the way down to leave."
            : description}
        </DrawerDescription>
        {body}
      </DrawerContent>
    </Drawer>
  );
}
