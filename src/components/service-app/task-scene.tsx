"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, ReactNode, RefObject } from "react";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A prepared environment for one primary task.
 *
 * Use it when the task benefits from focus: keyboard input, search,
 * comparison, map interaction, or a confirmation that deserves the whole
 * screen. Do not use it for a control that belongs inline in the current
 * scene.
 *
 * It rises from the bottom on mobile, matching the sheet's spatial paradigm,
 * so the workflow never jumps between unrelated presentations.
 */
export function TaskScene({
  open,
  title,
  description,
  onDismiss,
  initialFocusRef,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  onDismiss: () => void;
  /** Focused on open — a search scene should land on its input. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const settling = useSceneSettling(open);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Parent-driven close (progressing to another scene) must not be
        // treated as a user dismiss — that would fire `cancel_search` and
        // unwind the flow we just entered.
        if (!next && open) onDismiss();
      }}
    >
      {/* A selection inside the scene closes it, and the browser then delivers
          the same click to whatever the scene was covering — usually a task
          surface animating into that exact spot. Swallowing input for the
          length of that motion is what stops one tap answering two scenes. */}
      {settling ? (
        <div
          aria-hidden="true"
          data-scene-settling=""
          className="fixed inset-0 z-[100]"
        />
      ) : null}
      <DialogContent
        showCloseButton={false}
        initialFocus={initialFocusRef ?? true}
        className={cn(
          "bg-background top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 ring-0 sm:max-w-none",
          "motion-reduce:animate-none",
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function TaskSceneHeader({
  title,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
}) {
  return (
    <header className="flex shrink-0 items-center gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pr-5">
      <button
        type="button"
        onClick={onBack}
        className="focus-visible:ring-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon icon={ArrowLeft01Icon} size={22} />
        <span className="sr-only">{backLabel}</span>
      </button>
      <p className="min-w-0 truncate text-[17px] font-medium tracking-tight">
        {title}
      </p>
    </header>
  );
}

/** The single primary action of a scene. One per scene. */
export function PrimaryAction({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button className={cn("h-12 w-full", className)} {...props} />
  );
}

/**
 * True for one surface-motion window after the scene closes. Not a debounce on
 * the handler: the stray event is a *pointer* event aimed at the surface
 * underneath, so it has to be blocked in the DOM, not in the callback.
 */
const SCENE_SETTLE_MS = 280;

function useSceneSettling(open: boolean): boolean {
  const wasOpen = useRef(open);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed) return;
    setSettling(true);
    const id = window.setTimeout(() => setSettling(false), SCENE_SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  return settling;
}
