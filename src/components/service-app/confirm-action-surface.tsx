"use client";

import { useState, type ReactNode } from "react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ConfirmActionSurface — one high-consequence question about the current task.
 *
 * Cancel, delete, purchase, refund, dispatch, submit. It is always an
 * *interruption*: the scene underneath is suspended and restored, never
 * unmounted. Callers do not choose Drawer or Dialog — AdaptiveSurface.Interrupt
 * picks the presentation per viewport.
 *
 * If confirming does async work, return a promise from `onConfirm`: the
 * surface locks itself, blocks dismissal, and surfaces a failure inline
 * rather than closing on an outcome the backend never confirmed.
 */
export function ConfirmActionSurface({
  open,
  onOpenChange,
  id = "confirm",
  intent = "neutral",
  title,
  description,
  confirmLabel,
  cancelLabel = "Go back",
  onConfirm,
  onCancel,
  detail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  id?: string;
  intent?: "neutral" | "destructive";
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  onCancel?: () => void;
  /** Optional slot between the description and the actions. */
  detail?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (busy) return;
    setError(null);
    const result = onConfirm();
    if (!(result instanceof Promise)) return;
    setBusy(true);
    void result.then(
      () => setBusy(false),
      (cause: unknown) => {
        setBusy(false);
        setError(
          cause instanceof Error && cause.message.trim()
            ? cause.message
            : "That didn't go through. Nothing has changed.",
        );
      },
    );
  };

  const dismiss = () => {
    if (busy) return;
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <AdaptiveSurface.Interrupt
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
        else onOpenChange(true);
      }}
      id={id}
      label={title}
      description={description}
      locked={busy}
    >
      {detail}
      {error ? (
        <p role="alert" className="text-destructive text-sm leading-snug">
          {error}
        </p>
      ) : null}
      <Button
        variant={intent === "destructive" ? "destructive" : "default"}
        className="h-12 w-full rounded-xl"
        disabled={busy}
        onClick={confirm}
      >
        {busy ? "Working…" : confirmLabel}
      </Button>
      <Button
        variant="ghost"
        className={cn(
          "text-muted-foreground border-border h-11 w-full rounded-xl border",
        )}
        disabled={busy}
        onClick={dismiss}
      >
        {cancelLabel}
      </Button>
    </AdaptiveSurface.Interrupt>
  );
}
