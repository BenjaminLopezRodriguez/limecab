"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { OverlaySurface } from "@/components/service-app/overlay-surface";
import {
  TaskScene,
  TaskSceneHeader,
} from "@/components/service-app/task-scene";
import { useOptionalSurfaceManager } from "@/components/service-app/surface-manager";
import { useServiceAppMobile } from "@/hooks/use-service-app-mobile";
import { cn } from "@/lib/utils";
import {
  reduceSurfaceProgress,
  SURFACE_PROGRESS_IDLE,
  SURFACE_PROGRESS_MS,
  type SurfaceProgressEvent,
  type SurfaceProgressState,
} from "@/lib/service-app/surface-progress";
import type { TransitionIntent } from "@/lib/service-app/state";

/**
 * AdaptiveSurface — the kit's central primitive.
 *
 * One call site, two viewports. The same scene content is presented as a
 * bottom drawer on mobile and a floating panel on desktop; interruptions are
 * a compact drawer on mobile and a compact dialog on desktop. The calling app
 * never forks its logic on viewport.
 *
 * It owns three things:
 *   1. the presentation ladder (`peek → sheet → expanded → overlay | fullscreen`)
 *   2. the interruption stack, with suspend/restore of the parent scene
 *   3. the async progression choreography (see `surface-progress.ts`)
 */

export type SurfacePresentation =
  | "peek"
  | "sheet"
  | "expanded"
  | "fullscreen"
  | "overlay"
  | "compact-interrupt";

const SURFACE_PRESENTATIONS: readonly SurfacePresentation[] = [
  "peek",
  "sheet",
  "expanded",
  "fullscreen",
  "overlay",
  "compact-interrupt",
];

export function isSurfacePresentation(
  value: string | null | undefined,
): value is SurfacePresentation {
  return SURFACE_PRESENTATIONS.some((entry) => entry === value);
}

export type { TransitionIntent };

export type SurfaceEntry = {
  id: string;
  presentation: SurfacePresentation;
  interrupt?: boolean;
};

type SurfaceSnapshot = {
  presentation: SurfacePresentation;
  scrollTop: number;
  focus: HTMLElement | null;
};

export type SurfaceProgressInput<T> = {
  intent: "progress";
  /** Scene the user is leaving. Restored if `task` rejects. */
  from: string;
  /** Scene to enter once the surface has exited. Null holds on the canvas. */
  to?: string | null;
  /** What shows during the gap. "map" reveals the canvas behind the surface. */
  interim?: "parent" | "map";
  task: () => Promise<T>;
  /** Skip animation but keep the lock and the truthful state sequence. */
  skipChoreography?: boolean;
};

type StackTransitionInput = {
  intent: TransitionIntent;
  surface?: { id: string; presentation: SurfacePresentation };
};

type AdaptiveSurfaceContextValue = {
  isMobile: boolean;
  interrupted: boolean;
  presentation: SurfacePresentation;
  stack: SurfaceEntry[];
  progress: SurfaceProgressState;
  panelScrollRef: RefObject<HTMLElement | null>;
  setPresentation: (presentation: SurfacePresentation) => void;
  registerPanel: (node: HTMLElement | null) => void;
  transition: {
    (input: StackTransitionInput): void;
    <T>(input: SurfaceProgressInput<T>): Promise<T>;
  };
};

const AdaptiveSurfaceContext =
  createContext<AdaptiveSurfaceContextValue | null>(null);

export function useAdaptiveSurface() {
  const ctx = useContext(AdaptiveSurfaceContext);
  if (!ctx) {
    throw new Error(
      "useAdaptiveSurface must be used within AdaptiveSurface.Root",
    );
  }
  return ctx;
}

export function useOptionalAdaptiveSurface() {
  return useContext(AdaptiveSurfaceContext);
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function taskErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "Something went wrong. Nothing was submitted.";
}

function AdaptiveSurfaceRoot({ children }: { children: ReactNode }) {
  const isMobile = useServiceAppMobile();
  const panelScrollRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef<SurfaceSnapshot | null>(null);
  const progressRef = useRef(SURFACE_PROGRESS_IDLE);
  const inFlightRef = useRef<Promise<unknown> | null>(null);
  const generationRef = useRef(0);
  const [presentation, setPresentation] =
    useState<SurfacePresentation>("sheet");
  const [stack, setStack] = useState<SurfaceEntry[]>([
    { id: "root", presentation: "sheet" },
  ]);
  const [progress, setProgress] = useState(SURFACE_PROGRESS_IDLE);

  const registerPanel = useCallback((node: HTMLElement | null) => {
    panelScrollRef.current = node;
  }, []);

  /** Suspend: remember exactly enough to put the scene back untouched. */
  const capture = useCallback(() => {
    const focus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    snapshotRef.current = {
      presentation,
      scrollTop: panelScrollRef.current?.scrollTop ?? 0,
      focus,
    };
  }, [presentation]);

  const restore = useCallback(() => {
    const snapshot = snapshotRef.current;
    if (!snapshot) return;
    setPresentation(snapshot.presentation);
    requestAnimationFrame(() => {
      if (panelScrollRef.current) {
        panelScrollRef.current.scrollTop = snapshot.scrollTop;
      }
      snapshot.focus?.focus();
    });
  }, []);

  const applyProgress = useCallback((event: SurfaceProgressEvent) => {
    const next = reduceSurfaceProgress(progressRef.current, event);
    progressRef.current = next;
    setProgress(next);
    return next;
  }, []);

  const runProgress = useCallback(
    async <T,>(input: SurfaceProgressInput<T>): Promise<T> => {
      // Duplicate input is prevented here, not by a disabled button alone.
      if (progressRef.current.locked) {
        if (inFlightRef.current) return inFlightRef.current as Promise<T>;
        throw new Error("Surface is busy");
      }

      const generation = ++generationRef.current;
      const skip =
        Boolean(input.skipChoreography) || !isMobile || prefersReducedMotion();
      const wait = (ms: number) =>
        skip
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              window.setTimeout(resolve, ms);
            });

      const work = (async () => {
        applyProgress({
          type: "start",
          from: input.from,
          to: input.to ?? null,
          interim: Boolean(input.interim),
          skipChoreography: skip,
        });

        // The request runs *concurrently* with the choreography — the
        // animation covers latency, it does not follow it.
        const task = input.task().then(
          (value) => {
            applyProgress({ type: "task_resolved" });
            return value;
          },
          (error: unknown) => {
            applyProgress({
              type: "task_rejected",
              error: taskErrorMessage(error),
            });
            throw error;
          },
        );

        if (!skip) {
          await wait(SURFACE_PROGRESS_MS.exit);
          if (generation !== generationRef.current) return task;
          applyProgress({ type: "exit_complete" });
          await wait(SURFACE_PROGRESS_MS.interstitial);
          if (generation !== generationRef.current) return task;
          const afterGap = applyProgress({ type: "interstitial_complete" });
          if (afterGap.phase === "entering") {
            await wait(SURFACE_PROGRESS_MS.enter);
            if (generation !== generationRef.current) return task;
            applyProgress({ type: "enter_complete" });
          }
        }

        try {
          const value = await task;
          // The next surface owns the screen now: drop the lock so the app can
          // accept input again. Failures release via `restoreOrigin` instead.
          applyProgress({ type: "settle" });
          return value;
        } catch (error) {
          // Failure reverses to the origin surface rather than stranding the
          // user on an empty screen.
          let current = progressRef.current;
          if (current.phase === "entering") {
            await wait(SURFACE_PROGRESS_MS.enter);
            current = applyProgress({ type: "enter_complete" });
          }
          if (current.phase === "reversing" && !skip) {
            await wait(SURFACE_PROGRESS_MS.exit);
            applyProgress({ type: "exit_complete" });
            await wait(SURFACE_PROGRESS_MS.interstitial);
            applyProgress({ type: "interstitial_complete" });
          }
          throw error;
        }
      })();

      inFlightRef.current = work;
      // Handle the rejection here too, so a caller's own catch is the only
      // place it surfaces — an unattended `.finally` chain would report it as
      // an unhandled rejection.
      const release = () => {
        if (!progressRef.current.locked) inFlightRef.current = null;
      };
      void work.then(release, release);

      return work;
    },
    [applyProgress, isMobile],
  );

  const transition = useCallback(
    ((input: StackTransitionInput | SurfaceProgressInput<unknown>) => {
      if ("task" in input) return runProgress(input);

      const { intent, surface } = input;
      if (intent === "interrupt" && surface) {
        capture();
        setStack((current) => [
          ...current,
          {
            id: surface.id,
            presentation: surface.presentation,
            interrupt: true,
          },
        ]);
        return;
      }
      if (intent === "return") {
        setStack((current) =>
          current.length > 1 ? current.slice(0, -1) : current,
        );
        restore();
        return;
      }
      if (intent === "progress" && surface) {
        setPresentation(surface.presentation);
        setStack((current) => [
          ...current.slice(0, -1),
          { id: surface.id, presentation: surface.presentation },
        ]);
      }
    }) as AdaptiveSurfaceContextValue["transition"],
    [capture, restore, runProgress],
  );

  const interrupted = stack.some((entry) => entry.interrupt);

  const value = useMemo(
    () => ({
      isMobile,
      interrupted,
      presentation,
      stack,
      progress,
      panelScrollRef,
      setPresentation,
      registerPanel,
      transition,
    }),
    [
      isMobile,
      interrupted,
      presentation,
      stack,
      progress,
      registerPanel,
      transition,
    ],
  );

  return (
    <AdaptiveSurfaceContext.Provider value={value}>
      <div
        className="contents"
        data-surface-stack=""
        data-surface-phase={progress.phase}
        data-interrupted={interrupted ? "" : undefined}
        data-surface-locked={progress.locked ? "" : undefined}
      >
        {children}
      </div>
    </AdaptiveSurfaceContext.Provider>
  );
}

/**
 * Desktop presentation container for the task surface: a floating panel on
 * the right of the canvas. On mobile it is a passthrough — `ServiceSheet`
 * renders the drawer.
 */
function AdaptiveSurfacePanel({
  presentation = "sheet",
  className,
  children,
}: {
  presentation?: Exclude<SurfacePresentation, "compact-interrupt">;
  className?: string;
  children: ReactNode;
}) {
  const { setPresentation, progress } = useAdaptiveSurface();

  useEffect(() => {
    setPresentation(presentation);
  }, [presentation, setPresentation]);

  return (
    <div
      data-presentation={presentation}
      className={cn(
        "relative z-10 mt-auto",
        // Desktop: the overlay does not capture clicks, so the canvas behind
        // it stays the workspace.
        "md:pointer-events-none md:absolute md:inset-0 md:mt-0 md:flex md:justify-end md:p-6",
        className,
      )}
    >
      <div
        className={cn(
          "md:pointer-events-auto md:flex md:h-fit md:max-h-full md:min-h-0 md:w-[min(100%,24rem)] md:flex-col",
          !progress.sheetOpen && "md:hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A temporary question about the current task.
 *
 * Mounting it suspends the parent scene; unmounting restores it. The parent
 * is never unmounted, so drafts, scroll, and map state survive. On mobile the
 * parent recedes and this rises from the same edge — the spatial paradigm
 * does not change mid-task.
 */
function AdaptiveSurfaceInterrupt({
  open,
  onOpenChange,
  id = "interrupt",
  presentation: presentationProp,
  label,
  description,
  locked = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id?: string;
  presentation?: SurfacePresentation;
  label: string;
  description?: string;
  /** Blocks dismissal while the interruption's own work is in flight. */
  locked?: boolean;
  children: ReactNode;
}) {
  const surface = useAdaptiveSurface();
  const manager = useOptionalSurfaceManager();
  const layoutPresentation = manager?.layout[id]?.presentation;
  const presentation =
    presentationProp ??
    (isSurfacePresentation(layoutPresentation)
      ? layoutPresentation
      : "compact-interrupt");
  const transitionRef = useRef(surface.transition);
  transitionRef.current = surface.transition;

  useLayoutEffect(() => {
    if (!open) return;
    transitionRef.current({ intent: "interrupt", surface: { id, presentation } });
    return () => {
      transitionRef.current({ intent: "return" });
    };
  }, [id, open, presentation]);

  const handleOpenChange = (next: boolean) => {
    if (locked && !next) return;
    onOpenChange(next);
  };

  // Overlay: the same drawer, snapped to the viewport. Fullscreen: a
  // prepared TaskScene. Both suspend the parent; only the rung changes.
  if (presentation === "overlay") {
    return (
      <OverlaySurface
        open={open}
        title={label}
        description={description}
        onDismiss={() => handleOpenChange(false)}
      >
        {children}
      </OverlaySurface>
    );
  }

  if (presentation === "fullscreen") {
    return (
      <TaskScene
        open={open}
        title={label}
        description={description ?? label}
        onDismiss={() => handleOpenChange(false)}
      >
        <TaskSceneHeader
          title={label}
          onBack={() => handleOpenChange(false)}
          backLabel="Back"
        />
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:mx-auto md:w-full md:max-w-lg md:px-6">
          {children}
        </div>
      </TaskScene>
    );
  }

  if (surface.isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={handleOpenChange}
        modal
        disablePointerDismissal={locked}
        showSwipeHandle
        swipeDirection="down"
      >
        {/* Nested inside the task drawer, Base UI recedes and dims the parent
            automatically — the suspended scene stays visible behind this. */}
        <DrawerContent data-presentation={presentation}>
          <DrawerTitle className="px-5 pt-2 text-[17px] leading-snug font-medium tracking-tight">
            {label}
          </DrawerTitle>
          {description ? (
            <DrawerDescription className="text-muted-foreground px-5 pt-3 text-sm leading-relaxed">
              {description}
            </DrawerDescription>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={locked}
    >
      <DialogContent
        showCloseButton={false}
        data-presentation={presentation}
        className="w-[min(100%-2rem,24rem)] gap-0 rounded-2xl p-0 sm:max-w-none"
      >
        <DialogTitle className="px-6 pt-6 text-[17px] leading-snug font-medium tracking-tight">
          {label}
        </DialogTitle>
        {description ? (
          <DialogDescription className="text-muted-foreground px-6 pt-3 text-sm leading-relaxed">
            {description}
          </DialogDescription>
        ) : (
          <DialogDescription className="sr-only">{label}</DialogDescription>
        )}
        <div className="mt-6 flex flex-col gap-3 px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export const AdaptiveSurface = {
  Root: AdaptiveSurfaceRoot,
  Panel: AdaptiveSurfacePanel,
  Interrupt: AdaptiveSurfaceInterrupt,
};
