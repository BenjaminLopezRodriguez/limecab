"use client";

import { Gps01Icon, UserIcon } from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import {
  searchShortcutCopy,
  type SearchAudience,
  type SearchInputContract,
} from "@/lib/limecab/search-input";
import { cn } from "@/lib/utils";

/**
 * Intent-aware rows for the search overlay. The kit scene still asks "Where?";
 * these rows say whether "where" is here, a house, a shop, or someone else.
 *
 * Not a SurfaceManager action — no layout changes. The parent commits the
 * place the same way a typed suggestion does.
 */
export function LimeCabSearchInputAdapter({
  contract,
  audience,
  locating,
  onAudienceChange,
  onUseHere,
}: {
  contract: SearchInputContract;
  audience: SearchAudience;
  locating?: boolean;
  onAudienceChange: (next: SearchAudience) => void;
  onUseHere: () => void;
}) {
  if (contract.shortcuts.length === 0) return null;

  return (
    <ul className="-mx-2 mt-4">
      {contract.shortcuts.map((shortcut) => {
        const copy = searchShortcutCopy(shortcut, contract.role, audience);
        return (
          <li key={shortcut}>
            <ShortcutRow
              icon={
                shortcut === "use_here" ? (
                  <Icon icon={Gps01Icon} size={18} />
                ) : (
                  <Icon icon={UserIcon} size={18} />
                )
              }
              label={copy.label}
              secondary={copy.secondary}
              disabled={shortcut === "use_here" && locating}
              onPress={() => {
                if (shortcut === "use_here") {
                  if (audience === "other") onAudienceChange("self");
                  onUseHere();
                  return;
                }
                onAudienceChange("other");
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

function ShortcutRow({
  icon,
  label,
  secondary,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  secondary?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left",
        "hover:bg-accent active:bg-accent disabled:opacity-60",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
      )}
    >
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium tracking-tight">
          {label}
        </span>
        {secondary ? (
          <span className="text-muted-foreground block truncate text-sm">
            {secondary}
          </span>
        ) : null}
      </span>
    </button>
  );
}
