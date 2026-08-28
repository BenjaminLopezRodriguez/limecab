"use client";

import { useState } from "react";
import { Image01Icon } from "@hugeicons/core-free-icons";

import { ConfigureScene } from "@/components/service-app/configure-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Icon } from "@/components/ui/icon";
import { COURIER_OPTIONS } from "@/lib/limecab/courier";
import type {
  ServiceOption,
  ServiceOptionValue,
  ServiceOptionValues,
} from "@/lib/service-app/options";

/** Size, recipient, proof — the one question between destination and price. */
export function LimeCabConfigureScene({
  values,
  ready,
  onChange,
  onContinue,
}: {
  values: ServiceOptionValues;
  ready: boolean;
  onChange: (id: string, value: ServiceOptionValue) => void;
  onContinue: () => void;
}) {
  const buy = values.fulfillment === "buy";
  const [photoNote, setPhotoNote] = useState(false);
  const options: ServiceOption[] = COURIER_OPTIONS.filter((option) => {
    if (option.id === "itemDescription") return buy;
    return true;
  }).map((option) =>
    option.id === "size"
      ? {
          ...option,
          description: buy
            ? "A courier buys it, then brings it to the drop-off."
            : "Sealed and ready at pickup.",
        }
      : option,
  );

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-[17px] font-medium tracking-tight">
        {buy ? "What should they buy?" : "What are we carrying?"}
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {buy
          ? "Describe the item. Item cost is paid in store; this fare is the trip."
          : "A car comes to you. Size the load, then who receives it."}
      </p>
      <ConfigureScene
        className="mt-5"
        options={options}
        values={values}
        onChange={onChange}
      />
      {buy ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setPhotoNote(true)}
            className="ring-border focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm ring-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Icon icon={Image01Icon} size={18} className="text-muted-foreground" />
            Add a photo
          </button>
          {photoNote ? (
            <p role="status" className="text-muted-foreground mt-2 text-sm leading-relaxed">
              This build has no upload. Nothing was stored.
            </p>
          ) : null}
        </div>
      ) : null}
      {ready ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>See price</PrimaryAction>
        </SheetActions>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          {buy
            ? "Add what to buy, plus the recipient’s name and a phone number."
            : "Add the recipient’s name and a phone number to continue."}
        </p>
      )}
    </div>
  );
}
