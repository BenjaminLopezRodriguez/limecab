"use client";

import type { ReactNode } from "react";

import { PrimaryAction } from "@/components/service-app/task-scene";
import { SheetActions } from "@/components/service-app/service-sheet";

/**
 * Confirm strip for "Where on the map?".
 *
 * The canvas is the subject; this surface only names the point under the pin
 * and commits it. Back belongs to the sheet that hosts it.
 */
export function LocationPinScene({
  title,
  address,
  locating,
  confirmLabel,
  secondary,
  onConfirm,
}: {
  title: string;
  address: string | null;
  locating?: boolean;
  confirmLabel: string;
  /**
   * A quiet affordance about this point that is not the scene's answer —
   * filing it, sharing it. Sits above the action band, never beside Confirm.
   */
  secondary?: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
        {title}
      </p>
      <p className="min-h-11 text-[15px] leading-snug font-medium tracking-tight">
        {locating ? "Finding address…" : (address ?? "Move the map to place the pin")}
      </p>
      {secondary ? <div className="-mt-1">{secondary}</div> : null}
      <SheetActions>
        <PrimaryAction onClick={onConfirm} disabled={!address || locating}>
          {confirmLabel}
        </PrimaryAction>
      </SheetActions>
    </div>
  );
}
