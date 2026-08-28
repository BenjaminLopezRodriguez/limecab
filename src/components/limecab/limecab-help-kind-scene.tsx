"use client";

import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { HELP_PRODUCTS } from "@/lib/limecab/help";
import { cn } from "@/lib/utils";

/**
 * Lime Help — "What kind of help?"
 *
 * Two tiles, not the ride comparison list. Light tasks and Care are different
 * work with different rules, and that difference is this whole scene. The
 * note is an inline field on the same surface: a binary plus a note is still
 * one question.
 */
export function LimeCabHelpKindScene({
  productId,
  onSelect,
  note,
  onNoteChange,
  onContinue,
}: {
  productId: string | null;
  onSelect: (id: string) => void;
  note: string;
  onNoteChange: (next: string) => void;
  onContinue: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-[17px] font-medium tracking-tight">
        What kind of help?
      </h2>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Someone comes to the house for about an hour.
      </p>

      <div className="mt-5 flex flex-col gap-2">
        {HELP_PRODUCTS.map((product) => {
          const selected = product.id === productId;
          const care = product.id === "lime-care";
          return (
            <button
              key={product.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(product.id)}
              className={cn(
                "focus-visible:ring-ring rounded-2xl px-4 py-3.5 text-left ring-1 focus-visible:ring-2 focus-visible:outline-none",
                selected ? "ring-foreground ring-2" : "ring-border",
              )}
            >
              <p className="text-[17px] font-semibold tracking-tight">
                {care ? "Care" : "Light tasks"}
              </p>
              <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                {care
                  ? "Companionship and everyday help at home."
                  : "Bring in bags, a basic tidy, wait for a delivery, assemble something small."}
              </p>
              {/* The rider is told what the helper agreed to, not handed the
                  helper's rule list. */}
              {care ? (
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                  Your helper has agreed to Care rules. This is not medical
                  care.
                </p>
              ) : null}
            </button>
          );
        })}
      </div>

      {productId ? (
        <div className="mt-5">
          <label
            htmlFor="help-note"
            className="text-[15px] font-medium tracking-tight"
          >
            What needs doing?
          </label>
          <textarea
            id="help-note"
            rows={2}
            value={note}
            maxLength={160}
            placeholder="Groceries are on the porch, and the bins need bringing in."
            onChange={(event) => onNoteChange(event.target.value)}
            className="bg-card ring-border placeholder:text-muted-foreground focus-visible:ring-ring mt-2 w-full rounded-xl px-3 py-2.5 text-base leading-relaxed ring-1 focus-visible:ring-2 focus-visible:outline-none"
          />
        </div>
      ) : null}

      {productId ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>Continue</PrimaryAction>
        </SheetActions>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          Pick light tasks or Care to continue.
        </p>
      )}
    </div>
  );
}
