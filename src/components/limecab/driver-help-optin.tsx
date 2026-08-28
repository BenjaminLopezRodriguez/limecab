"use client";

import { useState } from "react";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { Button } from "@/components/ui/button";
import { CARE_RULES, CARE_RULES_VERSION } from "@/lib/limecab/help";

/**
 * Lime Help's driver consent.
 *
 * Help sends a driver into someone's home. A silent switch is not consent, so
 * the flag only flips on the far side of an explainer the driver has read and
 * accepted. Turning Help off clears the acknowledgement, so re-enabling shows
 * this again rather than silently restoring an old yes.
 *
 * It is an interruption of the page it opens from: the preferences (or the
 * register success) stay mounted underneath and come back untouched.
 */
export function HelpExplainSurface({
  open,
  busy,
  onEnable,
  onDismiss,
}: {
  open: boolean;
  busy: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}) {
  return (
    <AdaptiveSurface.Interrupt
      id="help-explain"
      open={open}
      locked={busy}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      label="Also take Help jobs?"
      description="What Lime Help sends you to do."
    >
      {/* The drawer's own header states the question; repeating it here would
          ask twice. */}
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-[15px] leading-relaxed">
          Lime Help sends you to someone’s home for a scheduled visit. Light
          tasks means household jobs: bringing in groceries, a basic tidy,
          waiting for a delivery, simple assembly.
        </p>
        <p className="text-[15px] leading-relaxed">
          You are not a cleaner on contract, not a mover, and not a nurse. You
          can decline any offer.
        </p>
        <p className="text-muted-foreground text-[15px] leading-relaxed">
          Care is separate — it has its own rules.
        </p>
        <Button
          size="lg"
          className="mt-1 h-14 w-full text-[17px]"
          aria-busy={busy || undefined}
          disabled={busy}
          onClick={onEnable}
        >
          I understand — enable Help
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground h-12 w-full"
          disabled={busy}
          onClick={onDismiss}
        >
          Not now
        </Button>
      </div>
    </AdaptiveSurface.Interrupt>
  );
}

/**
 * The Care rules, one at a time.
 *
 * Seven checkboxes under a scroll is a signature, not an understanding. Each
 * rule is the question the surface asks, and the primary control *is* the
 * acknowledgement of that rule; back revises the previous one. Only after the
 * last rule is there a control that enables Care at all.
 *
 * The index is content inside one interruption, not a second state machine:
 * it resets when the walk is abandoned, and `careJobs` stays false.
 */
export function CareRulesSurface({
  open,
  busy,
  error,
  onEnable,
  onDismiss,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onEnable: (input: { version: string; acknowledged: number }) => void;
  onDismiss: () => void;
}) {
  const [index, setIndex] = useState(0);
  const rule = CARE_RULES[index]!;
  const last = index === CARE_RULES.length - 1;
  /** Acknowledged so far. Reaching the end is what makes the walk complete. */
  const [acknowledged, setAcknowledged] = useState(0);

  const close = () => {
    setIndex(0);
    setAcknowledged(0);
    onDismiss();
  };

  return (
    <AdaptiveSurface.Interrupt
      id="care-rules"
      presentation="fullscreen"
      open={open}
      locked={busy}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      label="Care rules"
      description="What a Care visit is, one rule at a time."
    >
      <div className="flex min-h-full flex-col">
        <p className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          Rule {index + 1} of {CARE_RULES.length}
        </p>
        <h2 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.03em]">
          {rule.title}
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed">{rule.body}</p>

        {last ? (
          <p className="text-muted-foreground mt-4 text-[15px] leading-relaxed">
            Enabling Care records that you read all {CARE_RULES.length} rules
            today. If the rules change, you read them again.
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-destructive mt-4 text-[15px]">
            {error}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-1 pt-6">
          <Button
            size="lg"
            className="h-14 w-full text-[17px]"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={() => {
              const seen = Math.max(acknowledged, index + 1);
              setAcknowledged(seen);
              if (last) {
                onEnable({ version: CARE_RULES_VERSION, acknowledged: seen });
                return;
              }
              setIndex(index + 1);
            }}
          >
            {last ? "Enable Care jobs" : "I understand"}
          </Button>
          <Button
            variant="ghost"
            className="text-muted-foreground h-12 w-full"
            disabled={busy}
            onClick={() => (index === 0 ? close() : setIndex(index - 1))}
          >
            {index === 0 ? "Not now" : "Back"}
          </Button>
        </div>
      </div>
    </AdaptiveSurface.Interrupt>
  );
}
