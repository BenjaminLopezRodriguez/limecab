"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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
import {
  onOverlayChange,
  publishMapOverlay,
} from "@/components/service-app/map-overlay";
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
 * Anything taller is a window overlay (`TaskScene`), not another snap.
 *
 * Confirm, a payment ribbon, and similar thumb-zone controls belong in
 * `SheetActions`. They are optional progressive disclosure: a scene may omit
 * them until the rider has made the choice they confirm. When present they
 * anchor to the visible bottom of the sheet, over the scrolling body, in a
 * short constrained band.
 */
type SheetPresentation = Exclude<SurfacePresentation, "compact-interrupt">;

const PEEK = 0.22;
const SHEET = 0.4;
const EXPANDED = 0.6;

const SNAP_FOR: Record<SheetPresentation, number> = {
  peek: PEEK,
  sheet: SHEET,
  expanded: EXPANDED,
  fullscreen: EXPANDED,
};

const SNAP_POINTS = [PEEK, SHEET, EXPANDED];

const DESKTOP_MAX: Record<SheetPresentation, string> = {
  peek: "md:max-h-[22dvh]",
  sheet: "md:max-h-[40dvh]",
  expanded: "md:max-h-[60dvh]",
  fullscreen: "md:max-h-[60dvh]",
};

const SheetActionsAnchorContext = createContext<{
  host: HTMLElement | null;
  anchored: boolean;
}>({ host: null, anchored: false });

/**
 * Constrained thumb-zone for a scene: one primary action, optionally a
 * payment ribbon. Omit the component until there is something to confirm —
 * it then anchors to the visible bottom of the sheet. Cap is a ribbon + a
 * button, not a second sheet.
 */
export function SheetActions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const { host, anchored } = useContext(SheetActionsAnchorContext);
  const body = (
    <div
      className={cn(
        "flex flex-col gap-1",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200",
        className,
      )}
    >
      {children}
    </div>
  );
  if (anchored && !host) return null;
  if (!host) {
    return (
      <div className="bg-card border-border sticky bottom-0 z-10 -mx-5 mt-3 border-t px-5 pt-2.5 pb-1 md:-mx-6 md:px-6">
        {body}
      </div>
    );
  }
  return createPortal(body, host);
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
  const rung = SNAP_FOR[presentation];
  const [snap, setSnap] = useState<string | number | null>(rung);
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const overlayNode = useRef<HTMLElement | null>(null);
  const overlayRef = useCallback((node: HTMLElement | null) => {
    overlayNode.current = node;
  }, []);

  useEffect(() => {
    setSnap(rung);
  }, [rung]);

  useEffect(() => {
    if (!sheetOpen) return;
    let stop: (() => void) | undefined;
    const frame = window.requestAnimationFrame(() => {
      const node = isMobile
        ? document.querySelector<HTMLElement>("[data-map-overlay='primary']")
        : overlayNode.current;
      stop = publishMapOverlay(node);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      stop?.();
    };
  }, [isMobile, sheetOpen, snap, rung]);

  // Snap drawers are taller than the visible slice. Size the frame to what
  // actually intersects the viewport so the action band can pin to it.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !isMobile || !sheetOpen) return;

    const apply = () => {
      const popup = document.querySelector<HTMLElement>(
        "[data-map-overlay='primary']",
      );
      if (!popup) return;
      const box = popup.getBoundingClientRect();
      const handle = popup.querySelector<HTMLElement>(
        "[data-slot='drawer-swipe-handle']",
      );
      const handleH = handle?.getBoundingClientRect().height ?? 0;
      const visible = Math.max(
        0,
        Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0) - handleH,
      );
      frame.style.height = `${Math.round(visible)}px`;
    };

    apply();
    const popup = document.querySelector("[data-map-overlay='primary']");
    const observer = popup ? new ResizeObserver(apply) : null;
    if (popup) observer?.observe(popup);
    const stop = onOverlayChange(apply);
    window.addEventListener("resize", apply);
    return () => {
      observer?.disconnect();
      stop();
      window.removeEventListener("resize", apply);
      frame.style.height = "";
    };
  }, [isMobile, sheetOpen, snap, rung]);

  useLayoutEffect(() => {
    const host = actionsHost;
    const scroll = frameRef.current?.querySelector<HTMLElement>(
      "[data-sheet-scroll]",
    );
    if (!host || !scroll) return;
    const apply = () => {
      scroll.style.paddingBottom = host.offsetHeight
        ? `${host.offsetHeight}px`
        : "";
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(host);
    return () => {
      observer.disconnect();
      scroll.style.paddingBottom = "";
    };
  }, [actionsHost]);

  const body = (
    <SheetActionsAnchorContext.Provider
      value={{ host: actionsHost, anchored: true }}
    >
      <div
        ref={frameRef}
        className={cn(
          "relative flex min-h-0 flex-col overflow-hidden",
          !isMobile && "min-h-0 flex-1",
        )}
      >
        <div
          ref={surface?.registerPanel}
          data-sheet-scroll=""
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            isMobile ? "px-5 pt-1" : "px-6 pt-6",
          )}
          aria-busy={busy}
        >
          {children}
        </div>
        <div
          ref={setActionsHost}
          data-sheet-actions=""
          className={cn(
            "bg-card/95 absolute inset-x-0 bottom-0 z-10 overflow-y-auto border-t backdrop-blur-sm empty:hidden",
            "border-border shadow-[0_-8px_24px_rgba(26,24,20,0.06)]",
            // Ribbon + confirm. Not a third of the sheet.
            "max-h-[9.5rem]",
            isMobile
              ? "px-5 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              : "px-6 pt-3 pb-6",
          )}
        />
      </div>
    </SheetActionsAnchorContext.Provider>
  );

  if (!isMobile) {
    return (
      <div
        ref={overlayRef}
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
      snapPoints={SNAP_POINTS}
      snapPoint={snap}
      onSnapPointChange={setSnap}
    >
      <DrawerContent
        data-presentation={presentation}
        data-map-overlay="primary"
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
