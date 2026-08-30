"use client";

import { ArrowRight01Icon, CreditCardIcon } from "@hugeicons/core-free-icons";

import { ChoiceList, ChoiceRow } from "@/components/service-app/choice-list";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Icon } from "@/components/ui/icon";
import {
  rankSpaceOptions,
  spaceKindUnit,
  SPACES_SPANS,
  spacesPriceLabel,
  spacesRateLabel,
  type SpaceKind,
  type SpaceOption,
  type SpacesSpanId,
} from "@/lib/limecab/spaces";
import type { PaymentMethod } from "@/lib/limecab/domain";
import { cn } from "@/lib/utils";

/**
 * Lime Spaces — "Choose a space".
 *
 * The kind was answered on the scene before this one, so it is a summary
 * here, not a control. How many hours (or nights) *is* still open, and it is
 * an inline segmented control rather than its own scene: it re-prices the
 * list the rider is looking at, which is the case scene-preparation makes
 * for an inline adjustment over a whole prepared screen.
 */
export function LimeCabSpacesSelectScene({
  options,
  kind,
  span,
  selectedId,
  payment,
  simulated = true,
  onSpan,
  onSelect,
  onConfirm,
  onOpenPayment,
}: {
  options: readonly SpaceOption[];
  kind: SpaceKind | null;
  span: SpacesSpanId;
  selectedId: string | null;
  payment: PaymentMethod;
  simulated?: boolean;
  onSpan: (next: SpacesSpanId) => void;
  onSelect: (option: SpaceOption) => void;
  onConfirm: () => void;
  onOpenPayment: () => void;
}) {
  const rows = rankSpaceOptions(options, kind);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const unit = kind ? spaceKindUnit(kind) : "hour";
  const unitWord = unit === "night" ? "nights" : "hours";

  return (
    <>
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.02em]">
        Choose a space
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Held with the partner on confirm
        {simulated ? ". Rates are simulated" : ""}.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <span className="text-muted-foreground text-sm">{unitWord}</span>
        <div className="flex gap-1.5">
          {SPACES_SPANS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === span}
              aria-label={`${option.label} ${unitWord}`}
              onClick={() => onSpan(option.id)}
              className={cn(
                "focus-visible:ring-ring min-h-9 min-w-11 rounded-full px-3 text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:outline-none",
                option.id === span
                  ? "bg-foreground text-background"
                  : "bg-secondary text-secondary-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="bg-secondary/60 text-muted-foreground mt-4 rounded-3xl px-4 py-5 text-sm leading-relaxed">
          Nothing of that kind near there yet. Try another kind or another
          neighbourhood.
        </p>
      ) : (
        <ChoiceList className="mt-4">
          {rows.map((row) => (
            <ChoiceRow
              key={row.id}
              selected={row.id === selectedId}
              onClick={() => onSelect(row)}
            >
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[17px] font-semibold tracking-tight">
                    {row.name}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-sm">
                    {spacesRateLabel(row)}
                  </p>
                </div>
                <p className="shrink-0 text-[17px] font-semibold tabular-nums">
                  {spacesPriceLabel(row, span)}
                </p>
              </div>
            </ChoiceRow>
          ))}
        </ChoiceList>
      )}

      {selected ? (
        <SheetActions>
          <button
            type="button"
            onClick={onOpenPayment}
            aria-label={`Payment: ${payment.detail}. Change`}
            className="focus-visible:ring-ring flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
          >
            <Icon
              icon={CreditCardIcon}
              size={16}
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate text-sm">
              {payment.detail}
            </span>
            <Icon
              icon={ArrowRight01Icon}
              size={16}
              className="text-muted-foreground shrink-0"
              aria-hidden="true"
            />
          </button>
          <PrimaryAction onClick={onConfirm}>
            {`Confirm ${selected.name} · ${spacesPriceLabel(selected, span)}`}
          </PrimaryAction>
        </SheetActions>
      ) : null}
    </>
  );
}
