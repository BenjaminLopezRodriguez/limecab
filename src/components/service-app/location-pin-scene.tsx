"use client";

import { PrimaryAction } from "@/components/service-app/task-scene";

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
  onConfirm,
}: {
  title: string;
  address: string | null;
  locating?: boolean;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.12em] uppercase">
        {title}
      </p>
      <p className="min-h-11 text-[15px] leading-snug font-medium tracking-tight">
        {locating ? "Finding address…" : (address ?? "Move the map to place the pin")}
      </p>
      <PrimaryAction onClick={onConfirm} disabled={!address || locating}>
        {confirmLabel}
      </PrimaryAction>
    </div>
  );
}
