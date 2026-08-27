"use client";

import { ConfigureScene } from "@/components/service-app/configure-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { COURIER_OPTIONS } from "@/lib/limecab/courier";
import type {
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
  return (
    <div>
      <h2 className="text-[17px] font-medium tracking-tight">
        What are we carrying?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        A car comes to you. Size the load, then who receives it.
      </p>
      <ConfigureScene
        className="mt-5"
        options={COURIER_OPTIONS}
        values={values}
        onChange={onChange}
      />
      {ready ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>See price</PrimaryAction>
        </SheetActions>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          Add the recipient’s name and a phone number to continue.
        </p>
      )}
    </div>
  );
}
