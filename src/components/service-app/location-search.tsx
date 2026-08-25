"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import type {
  GeocodeAdapter,
  LocationSuggestion,
} from "@/lib/service-app/geocode-adapter";
import type { Location } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * Accessible address combobox over a `GeocodeAdapter`.
 *
 * Degrades silently: if lookup fails, free text still commits, because the
 * user's typed address is better than a dead end.
 */
export function LocationSearch({
  adapter,
  value = "",
  onSelect,
  placeholder = "Search an address…",
  autoFocus,
  className,
  layout = "scene",
  inputRef,
}: {
  adapter: GeocodeAdapter;
  value?: string;
  onSelect: (result: Location) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** "scene" renders results in flow; "overlay" floats them over the field. */
  layout?: "overlay" | "scene";
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const listId = React.useId();
  const [text, setText] = React.useState(value);
  const [lastValue, setLastValue] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  // Adopt an externally-changed `value` without an effect.
  if (value !== lastValue) {
    setLastValue(value);
    setText(value);
    setOpen(false);
    setSuggestions([]);
  }

  const query = open ? text.trim() : "";

  React.useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const results = await adapter.suggest(query, controller.signal);
          setSuggestions(results);
          setActive(-1);
        } catch {
          setSuggestions([]);
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [adapter, query]);

  const commitRaw = () => {
    const address = text.trim();
    if (!address) return;
    setOpen(false);
    onSelect({ address });
  };

  const choose = async (suggestion: LocationSuggestion) => {
    setText(suggestion.address);
    setLastValue(suggestion.address);
    setOpen(false);
    setSuggestions([]);
    try {
      const resolved = await adapter.retrieve(suggestion.id);
      onSelect({ ...resolved, address: resolved.address || suggestion.address });
    } catch {
      onSelect({ address: suggestion.address });
    }
  };

  const listOpen = open && suggestions.length > 0;

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!listOpen) return;
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => {
        const next = index + delta;
        if (next < 0) return suggestions.length - 1;
        if (next >= suggestions.length) return 0;
        return next;
      });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const picked = listOpen && active >= 0 ? suggestions[active] : undefined;
      if (picked) void choose(picked);
      else commitRaw();
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        type="text"
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Address"
        aria-activedescendant={
          listOpen && active >= 0 ? `${listId}-${active}` : undefined
        }
        ref={inputRef}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        placeholder={placeholder}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          if (layout === "scene") return;
          window.setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={onKeyDown}
        className="h-12 rounded-xl text-[15px]"
      />
      {listOpen ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Address suggestions"
          className={
            layout === "scene"
              ? "mt-3 overflow-hidden"
              : "bg-popover border-border absolute top-[calc(100%+6px)] right-0 left-0 z-20 overflow-hidden rounded-2xl border py-1 shadow-lg"
          }
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void choose(suggestion)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-11 w-full flex-col justify-center px-4 py-2 text-left",
                  index === active && "bg-accent",
                )}
              >
                <span className="truncate text-[15px]">{suggestion.address}</span>
                {suggestion.context ? (
                  <span className="text-muted-foreground truncate text-xs">
                    {suggestion.context}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
