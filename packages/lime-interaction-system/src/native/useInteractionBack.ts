import { useCallback, useEffect } from "react";
import { BackHandler, Platform } from "react-native";
import type { BackContext, BackDisposition, BackResolver } from "../core/back.ts";

/**
 * The boundary between interaction back and navigation back.
 *
 *   gesture / hardware back
 *          ↓
 *   BackResolver  ->  BackDisposition
 *          ↓
 *   handled here?  yes -> interaction state changes, navigation stays put
 *                  no  -> the host may pop a route
 *
 * The resolver *decides*; this executes. That split is why a live driver job cannot be
 * destroyed by a generic navigation gesture: `minimize-live-work` is a disposition the host
 * never sees, and `consume` deliberately does nothing at all — Rider Home's silent no-op is
 * behaviour, not an oversight, and turning it into a route pop would be a regression.
 */

export interface BackHandlers {
  dismissTransient?: () => void;
  returnInterrupt?: () => void;
  regressScene?: () => void;
  minimizeLiveWork?: () => void;
  exitProduct?: () => void;
  /** The only path that hands control to the host navigator. */
  delegateToHost?: () => void;
}

/** Exported for tests: pure disposition → handler dispatch, no React, no navigation. */
export function applyBackDisposition(
  disposition: BackDisposition,
  handlers: BackHandlers,
): "handled" | "delegated" {
  switch (disposition.type) {
    case "dismiss-transient":
      handlers.dismissTransient?.();
      return "handled";
    case "return-interrupt":
      handlers.returnInterrupt?.();
      return "handled";
    case "regress-scene":
      handlers.regressScene?.();
      return "handled";
    case "minimize-live-work":
      handlers.minimizeLiveWork?.();
      return "handled";
    case "exit-product":
      handlers.exitProduct?.();
      return "handled";
    case "consume":
      // Absorbed on purpose. Nothing happens, and nothing should.
      return "handled";
    case "delegate-to-host":
      handlers.delegateToHost?.();
      return "delegated";
  }
}

export interface UseInteractionBackOptions {
  resolver: BackResolver;
  context: BackContext;
  handlers: BackHandlers;
  enabled?: boolean;
}

/**
 * Returns the back action so a header button or a screen gesture can share one path with the
 * Android hardware button. `true` means the interaction system consumed the event.
 */
export function useInteractionBack({
  resolver,
  context,
  handlers,
  enabled = true,
}: UseInteractionBackOptions): () => boolean {
  const onBack = useCallback(() => {
    if (!enabled) return false;
    return applyBackDisposition(resolver(context), handlers) === "handled";
  }, [enabled, resolver, context, handlers]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [onBack]);

  return onBack;
}
