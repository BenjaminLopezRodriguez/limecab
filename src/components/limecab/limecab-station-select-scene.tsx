"use client";

import { ArrowRight01Icon, CreditCardIcon } from "@hugeicons/core-free-icons";

import { ChoiceList, ChoiceRow } from "@/components/service-app/choice-list";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Icon } from "@/components/ui/icon";
import {
  rankStationOptions,
  stationMetaLabel,
  stationPriceLabel,
  type StationDurationId,
  type StationOption,
} from "@/lib/limecab/station";
import type { PaymentMethod } from "@/lib/limecab/domain";

/**
 * Lime Station — "Choose parking".
 *
 * Ride's comparison scene with parking's two variables: what the walk costs
 * in minutes and what the block costs in money. Confirm lives in the band on
 * this same surface, exactly as picking a tier does — the choice *is* the
 * purchase, so a separate confirmation scene would be a second question
 * about the same decision.
 */
export function LimeCabStationSelectScene({
  options,
  duration,
  selectedId,
  payment,
  simulated = true,
  onSelect,
  onConfirm,
  onOpenPayment,
}: {
  options: readonly StationOption[];
  duration: StationDurationId;
  selectedId: string | null;
  payment: PaymentMethod;
  /** Rates are invented until a lot partner is wired. Say so. */
  simulated?: boolean;
  onSelect: (option: StationOption) => void;
  onConfirm: () => void;
  onOpenPayment: () => void;
}) {
  const rows = rankStationOptions(options);
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <>
      <h2 className="font-heading text-[22px] font-semibold tracking-[-0.02em]">
        Choose parking
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Walk times are estimates{simulated ? " and rates are simulated" : ""}.
      </p>

      {rows.length === 0 ? (
        <p className="bg-secondary/60 text-muted-foreground mt-4 rounded-3xl px-4 py-5 text-sm leading-relaxed">
          No lots near there yet. Try a different spot.
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
                    {stationMetaLabel(row)}
                  </p>
                </div>
                <p className="shrink-0 text-[17px] font-semibold tabular-nums">
                  {stationPriceLabel(row, duration)}
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
            {`Confirm ${selected.name} · ${stationPriceLabel(selected, duration)}`}
          </PrimaryAction>
        </SheetActions>
      ) : null}
    </>
  );
}
