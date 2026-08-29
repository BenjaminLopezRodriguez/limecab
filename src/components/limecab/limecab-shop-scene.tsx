"use client";

import { Delete02Icon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";

import { ConfigureScene } from "@/components/service-app/configure-scene";
import { SheetActions } from "@/components/service-app/service-sheet";
import { PrimaryAction } from "@/components/service-app/task-scene";
import { Icon } from "@/components/ui/icon";
import {
  shopItemQty,
  SHOP_LABEL_MAX,
  SHOP_LIST_MAX,
  SHOP_NOTE_MAX,
  SHOP_QTY_MAX,
  type ShopItem,
} from "@/lib/limecab/shop-list";
import { SHOP_OPTIONS } from "@/lib/limecab/courier";
import type {
  ServiceOptionValue,
  ServiceOptionValues,
} from "@/lib/service-app/options";
import { cn } from "@/lib/utils";

/**
 * Lime Shop — "What should they buy?"
 *
 * The list *is* the order: a courier buys these lines at the store above and
 * delivers them. No catalogue, no SKU, no price per line — item cost is paid
 * in store, and this build does not reimburse it.
 *
 * Deliberately not the packed-courier configure scene: the packed path asks
 * what is already sealed at pickup, and that question has no list in it.
 */
export function LimeCabShopScene({
  store,
  items,
  onItemsChange,
  values,
  ready,
  onChange,
  onContinue,
  onEditStore,
}: {
  /** The shop, already chosen. A summary that returns to its scene. */
  store: string;
  items: ShopItem[];
  onItemsChange: (next: ShopItem[]) => void;
  values: ServiceOptionValues;
  ready: boolean;
  onChange: (id: string, value: ServiceOptionValue) => void;
  onContinue: () => void;
  onEditStore: () => void;
}) {
  const setRow = (index: number, patch: Partial<ShopItem>) =>
    onItemsChange(
      items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  const filled = items.filter((item) => item.label.trim().length > 0).length;

  return (
    <div className="flex min-h-full flex-col">
      <h2 className="text-[17px] font-medium tracking-tight">
        What should they buy?
      </h2>
      <button
        type="button"
        onClick={onEditStore}
        className="text-muted-foreground focus-visible:ring-ring mt-1 self-start rounded-md text-left text-sm leading-relaxed focus-visible:ring-2 focus-visible:outline-none"
      >
        At {store} · change
      </button>

      <ul className="mt-4 flex flex-col gap-3">
        {items.map((item, index) => {
          const qty = shopItemQty(item);
          return (
            <li key={index} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={item.label}
                    maxLength={SHOP_LABEL_MAX}
                    aria-label={`Item ${index + 1}`}
                    placeholder="Oat milk"
                    onChange={(event) =>
                      setRow(index, { label: event.target.value })
                    }
                    className={cn(
                      "bg-card ring-border placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-xl py-2.5 pl-3 text-base leading-relaxed ring-1 focus-visible:ring-2 focus-visible:outline-none",
                      qty > 1 ? "pr-[6.75rem]" : "pr-12",
                    )}
                  />
                  <QuantityCluster
                    qty={qty}
                    index={index}
                    onChange={(next) =>
                      setRow(index, { qty: next > 1 ? next : undefined })
                    }
                  />
                </div>
                {/* The note is the whole substitutions story: no brand picker,
                    no SKU, no "call me from the aisle". */}
                {item.label.trim() ? (
                  <input
                    type="text"
                    value={item.note ?? ""}
                    maxLength={SHOP_NOTE_MAX}
                    aria-label={`Note for item ${index + 1}`}
                    placeholder="Any brand is fine"
                    onChange={(event) =>
                      setRow(index, { note: event.target.value })
                    }
                    className="text-muted-foreground placeholder:text-muted-foreground/70 focus-visible:ring-ring mt-1 w-full rounded-lg px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  />
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Remove item ${index + 1}`}
                disabled={items.length === 1}
                onClick={() =>
                  onItemsChange(items.filter((_, i) => i !== index))
                }
                className={cn(
                  "text-muted-foreground focus-visible:ring-ring mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none",
                  items.length === 1 && "opacity-30",
                )}
              >
                <Icon icon={Delete02Icon} size={18} />
              </button>
            </li>
          );
        })}
      </ul>

      {items.length < SHOP_LIST_MAX ? (
        <button
          type="button"
          onClick={() => onItemsChange([...items, { label: "" }])}
          className="text-foreground ring-border focus-visible:ring-ring mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-medium ring-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon icon={PlusSignIcon} size={16} />
          Add another
        </button>
      ) : (
        <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
          Twelve items is the cap for one shop.
        </p>
      )}

      <ConfigureScene
        className="mt-6"
        options={SHOP_OPTIONS}
        values={values}
        onChange={onChange}
      />

      {ready ? (
        <SheetActions>
          <PrimaryAction onClick={onContinue}>Continue</PrimaryAction>
        </SheetActions>
      ) : (
        <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
          {filled === 0
            ? "Add at least one item, plus who is receiving it."
            : "Add the recipient’s name and a phone number to continue."}
        </p>
      )}
    </div>
  );
}

/**
 * Qty lives on the line, not as a second question. One + until they
 * actually want more than one, then the stepper: Milk [− 2 +].
 */
function QuantityCluster({
  qty,
  index,
  onChange,
}: {
  qty: number;
  index: number;
  onChange: (qty: number) => void;
}) {
  const item = `item ${index + 1}`;
  if (qty <= 1) {
    return (
      <button
        type="button"
        aria-label={`Increase quantity of ${item}`}
        onClick={() => onChange(2)}
        className="text-muted-foreground focus-visible:ring-ring absolute top-0.5 right-0.5 flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon icon={PlusSignIcon} size={16} />
      </button>
    );
  }
  return (
    <div className="bg-card absolute inset-y-0.5 right-0.5 flex items-center rounded-lg">
      <button
        type="button"
        aria-label={`Decrease quantity of ${item}`}
        onClick={() => onChange(qty - 1)}
        className="text-muted-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon icon={MinusSignIcon} size={16} />
      </button>
      <output
        aria-live="polite"
        aria-label={`Quantity of ${item}`}
        className="w-6 text-center text-[15px] tabular-nums"
      >
        {qty}
      </output>
      <button
        type="button"
        aria-label={`Increase quantity of ${item}`}
        disabled={qty >= SHOP_QTY_MAX}
        onClick={() => onChange(qty + 1)}
        className="text-muted-foreground focus-visible:ring-ring flex size-11 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40"
      >
        <Icon icon={PlusSignIcon} size={16} />
      </button>
    </div>
  );
}
