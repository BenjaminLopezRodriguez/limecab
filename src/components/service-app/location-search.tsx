"use client";

import * as React from "react";
import { Location01Icon } from "@hugeicons/core-free-icons";

import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
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
  before,
  after,
  start,
  end,
  fieldsClassName,
  inputClassName,
  normalizeQuery,
  renderResults,
  rowAction,
  ariaLabel = "Address",
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
  /**
   * Slots inside the field group, above and below the input. They exist so a
   * caller can present the input as one field of a connected set — an
   * origin/destination pair, say — without the results list landing between
   * the fields.
   */
  before?: React.ReactNode;
  after?: React.ReactNode;
  /** Leading glyph inside the input (plus). Does not change default chrome. */
  start?: React.ReactNode;
  /** Trailing control inside the input row (locate, clear). */
  end?: React.ReactNode;
  fieldsClassName?: string;
  inputClassName?: string;
  /** Rewrite the typed string before suggesting, without changing the field. */
  normalizeQuery?: (query: string) => string;
  /**
   * Replace the default suggestion list. Return `undefined` to keep it.
   * Product grouping belongs in the caller, not here.
   */
  /**
   * A trailing control per suggestion row — filing the address, say. It sits
   * over the row's own button rather than inside it, so choosing the place and
   * acting on it stay two separate targets.
   */
  rowAction?: (suggestion: LocationSuggestion) => React.ReactNode;
  renderResults?: (input: {
    suggestions: LocationSuggestion[];
    query: string;
    choose: (suggestion: LocationSuggestion) => void;
    active: number;
    listId: string;
    setActive: (index: number) => void;
    searching: boolean;
  }) => React.ReactNode | undefined;
  ariaLabel?: string;
}) {
  const listId = React.useId();
  const [text, setText] = React.useState(value);
  const [lastValue, setLastValue] = React.useState(value);
  const [suggestions, setSuggestions] = React.useState<LocationSuggestion[]>(
    [],
  );
  const [searching, setSearching] = React.useState(false);
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
  const lookup = normalizeQuery ? normalizeQuery(query) : query;

  React.useEffect(() => {
    if (lookup.length < 3) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      void (async () => {
        try {
          const results = await adapter.suggest(lookup, controller.signal);
          setSuggestions(results);
          setActive(-1);
        } catch {
          setSuggestions([]);
        } finally {
          if (!controller.signal.aborted) setSearching(false);
        }
      })();
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [adapter, lookup]);

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
      onSelect({
        ...resolved,
        address: resolved.address || suggestion.address,
      });
    } catch {
      onSelect({ address: suggestion.address });
    }
  };

  const listOpen =
    open && (suggestions.length > 0 || (searching && lookup.length >= 3));

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
      <div className={cn("relative", fieldsClassName)}>
        {before}
        <div className="relative">
          {start ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center"
            >
              {start}
            </span>
          ) : null}
          <Input
            type="text"
            role="combobox"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-label={ariaLabel}
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
            className={cn(
            "h-12 rounded-full",
              inputClassName,
              start && "pl-11",
              end && "pr-20",
            )}
          />
          {end ? (
            <div className="absolute inset-y-0 right-1 z-10 flex items-center">
              {end}
            </div>
          ) : null}
        </div>
        {after}
      </div>
      {listOpen
        ? (renderResults?.({
            suggestions,
            query: query,
            choose: (suggestion) => void choose(suggestion),
            active,
            listId,
            setActive,
            searching,
          }) ??
          (suggestions.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label="Address suggestions"
              className={
                layout === "scene"
                  ? "-mx-2 mt-2 overflow-hidden"
                  : "bg-popover border-border absolute top-[calc(100%+6px)] right-0 left-0 z-20 overflow-hidden rounded-2xl border py-1 shadow-lg"
              }
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={suggestion.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className="relative"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void choose(suggestion)}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left",
                      index === active && "bg-accent",
                      rowAction && "pr-12",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full"
                    >
                      <Icon icon={Location01Icon} size={18} />
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
                  {rowAction ? (
                    <span className="absolute inset-y-0 right-1 flex items-center">
                      {rowAction(suggestion)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null))
        : null}
    </div>
  );
}
