"use client";

import {
  Car01Icon,
  Home01Icon,
  Package01Icon,
  ShoppingBag01Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/icon";
import type { LocationSuggestion } from "@/lib/service-app/geocode-adapter";
import {
  classifySearchQuery,
  isAddressQuery,
  type SearchIntent,
} from "@/lib/limecab/search-intent";
import { cn } from "@/lib/utils";

const SECTION: Record<SearchIntent, { title: string; icon: ReactNode }> = {
  ride: { title: "Ride there", icon: <Icon icon={Car01Icon} size={18} /> },
  send: { title: "Send there", icon: <Icon icon={Package01Icon} size={18} /> },
  store: {
    title: "Get from a store",
    icon: <Icon icon={ShoppingBag01Icon} size={18} />,
  },
  help: { title: "Help at home", icon: <Icon icon={Home01Icon} size={18} /> },
};

export function limeCabNormalizeQuery(query: string): string {
  const classified = classifySearchQuery(query);
  return classified.placeQuery || query;
}

export function renderLimeCabSearchResults({
  suggestions,
  query,
  active,
  listId,
  setActive,
  onChooseIntent,
}: {
  suggestions: LocationSuggestion[];
  query: string;
  choose: (suggestion: LocationSuggestion) => void;
  active: number;
  listId: string;
  setActive: (index: number) => void;
  onChooseIntent: (
    suggestion: LocationSuggestion,
    intent: SearchIntent,
  ) => void;
}): ReactNode | undefined {
  if (suggestions.length === 0) return undefined;
  const classified = classifySearchQuery(query);
  if (isAddressQuery(query) || classified.intents.length <= 1) {
    return undefined;
  }

  return (
    <div className="-mx-2 mt-2">
      {classified.intents.map((intent) => (
        <section key={intent} className="mt-3 first:mt-0">
          <p className="text-muted-foreground px-2 text-[11px] font-medium tracking-[0.12em] uppercase">
            {SECTION[intent].title}
          </p>
          <ul role="listbox" aria-label={SECTION[intent].title}>
            {suggestions.map((suggestion, index) => (
              <li key={`${intent}-${suggestion.id}`}>
                <button
                  type="button"
                  id={
                    intent === classified.intents[0]
                      ? `${listId}-${index}`
                      : undefined
                  }
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChooseIntent(suggestion, intent)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left",
                    index === active &&
                      intent === classified.intents[0] &&
                      "bg-accent",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
                  >
                    {SECTION[intent].icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium tracking-tight">
                      {suggestion.address}
                    </span>
                    {suggestion.context ? (
                      <span className="text-muted-foreground block truncate text-sm">
                        {suggestion.context}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
