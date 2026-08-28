"use client";

import type { ReactNode, RefObject } from "react";

import {
  TaskScene,
  TaskSceneHeader,
} from "@/components/service-app/task-scene";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useServiceAppMobile } from "@/hooks/use-service-app-mobile";

/**
 * A drawer that has slid up to fill the screen.
 *
 * Same spatial paradigm as the sheet — it rises from the bottom edge — but
 * the question needs the keyboard and a list, so the drawer takes the
 * viewport. SurfaceManager flags this with `presentation: "overlay"`.
 * `TaskScene` (`fullscreen`) is the other full-screen interrupt: a dialog,
 * not a drawer.
 *
 * Desktop: the same full overlay as `TaskScene`. Presentation adapts; the
 * question does not.
 */
export function OverlaySurface({
  open,
  title,
  description,
  onDismiss,
  initialFocusRef,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onDismiss: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
}) {
  const isMobile = useServiceAppMobile();

  if (!isMobile) {
    return (
      <TaskScene
        open={open}
        title={title}
        description={description ?? title}
        onDismiss={onDismiss}
        initialFocusRef={initialFocusRef}
      >
        <TaskSceneHeader title={title} onBack={onDismiss} backLabel="Back" />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </TaskScene>
    );
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next && open) onDismiss();
      }}
      modal
      showSwipeHandle
      swipeDirection="down"
      snapPoints={OVERLAY_SNAP}
      snapPoint={1}
    >
      <DrawerContent
        data-presentation="overlay"
        className="data-[swipe-direction=down]:rounded-none [--drawer-content-height:100dvh] [--drawer-content-max-height:100dvh]"
      >
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <DrawerDescription className="sr-only">
          {description ?? title}
        </DrawerDescription>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TaskSceneHeader title={title} onBack={onDismiss} backLabel="Back" />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

const OVERLAY_SNAP = [1];
