"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export function SettingSwitch({
  label,
  description,
  defaultChecked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  defaultChecked: boolean;
  /** Omit and the switch is local only — say so on the page if it is. */
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        const next = !checked;
        setChecked(next);
        onChange?.(next);
      }}
      className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium tracking-tight">
          {label}
        </span>
        {description ? (
          <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">
            {description}
          </span>
        ) : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative h-7 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-lime" : "bg-muted ring-border ring-1",
        )}
      >
        <span
          className={cn(
            "bg-card absolute top-0.5 left-0.5 size-6 rounded-full shadow-sm transition-transform",
            checked && "translate-x-4",
          )}
        />
      </span>
    </button>
  );
}
