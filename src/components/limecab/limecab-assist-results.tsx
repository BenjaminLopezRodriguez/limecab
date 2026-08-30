"use client";

import type { ReactNode } from "react";

import {
  AssistTextcon,
  parseAssistMessage,
} from "@/components/limecab/assist-textcon";
import { textconIdForPlan } from "@/lib/limecab/assist-textcon";
import type {
  AssistPlan,
  AssistResponse,
  AssistSuggestion,
} from "@/lib/limecab/assist";
import type { LocationSuggestion } from "@/lib/service-app/geocode-adapter";
import { cn } from "@/lib/utils";

export function renderAssistSearchResults({
  suggestions,
  active,
  listId,
  setActive,
  searching,
  planFor,
  onChoose,
  response,
}: {
  suggestions: LocationSuggestion[];
  query: string;
  choose: (suggestion: LocationSuggestion) => void;
  active: number;
  listId: string;
  setActive: (index: number) => void;
  searching?: boolean;
  planFor: (id: string) => AssistPlan | undefined;
  onChoose: (plan: AssistPlan) => void;
  response?: AssistResponse;
}): ReactNode | undefined {
  if (searching && suggestions.length === 0) {
    return <AssistTyping />;
  }

  const options = resolveSuggestions(response, suggestions, planFor);
  const message = response?.message?.trim() ?? "";

  if (!message && options.length === 0) return undefined;

  const mosaic = isMosaic(options);

  return (
    <div className="-mx-2 mt-3 space-y-3" aria-live="polite">
      {message ? (
        <p className="text-foreground px-2 text-[14px] leading-relaxed tracking-tight">
          {parseAssistMessage(message)}
        </p>
      ) : null}

      {options.length === 0 ? (
        <p className="text-muted-foreground px-2 text-[13px] leading-relaxed">
          Try a place, a shop list, or help at home.
        </p>
      ) : mosaic ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Assist options"
          className="grid grid-cols-2 gap-2 px-2"
        >
          {options.map((option, index) => (
            <li key={option.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
              <SuggestionTile
                option={option}
                active={index === active}
                onHover={() => setActive(index)}
                onChoose={() => onChoose(option.plan)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <ul
          id={listId}
          role="listbox"
          aria-label="Assist options"
          className="flex flex-wrap gap-2 px-2"
        >
          {options.map((option, index) => (
            <li key={option.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}>
              <SuggestionChip
                option={option}
                active={index === active}
                onHover={() => setActive(index)}
                onChoose={() => onChoose(option.plan)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function resolveSuggestions(
  response: AssistResponse | undefined,
  suggestions: LocationSuggestion[],
  planFor: (id: string) => AssistPlan | undefined,
): AssistSuggestion[] {
  const fromResponse = response?.suggestions?.length
    ? response.suggestions
    : response?.cards;
  if (fromResponse?.length) return fromResponse;
  return suggestions.flatMap((suggestion) => {
    if (suggestion.id === "assist:reply") return [];
    const plan = planFor(suggestion.id);
    if (!plan) return [];
    return [{ id: suggestion.id, plan }];
  });
}

function isMosaic(options: AssistSuggestion[]): boolean {
  if (options.length >= 3) return true;
  const kinds = new Set(options.map((option) => option.plan.kind));
  return kinds.size > 1;
}

function SuggestionTile({
  option,
  active,
  onHover,
  onChoose,
}: {
  option: AssistSuggestion;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const textcon = textconIdForPlan(option.plan);
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      onMouseEnter={onHover}
      className={cn(
        "bg-card ring-border flex min-h-[5.25rem] w-full flex-col items-start gap-2 rounded-2xl p-3 text-left ring-1",
        "touch-manipulation",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active && "ring-lime",
      )}
    >
      <AssistTextcon id={textcon} />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium tracking-tight">
          {option.plan.title}
        </span>
        {option.plan.subtitle ? (
          <span className="text-muted-foreground mt-0.5 block text-[12px] leading-snug">
            {option.plan.subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function SuggestionChip({
  option,
  active,
  onHover,
  onChoose,
}: {
  option: AssistSuggestion;
  active: boolean;
  onHover: () => void;
  onChoose: () => void;
}) {
  const textcon = textconIdForPlan(option.plan);
  return (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onChoose}
      onMouseEnter={onHover}
      className={cn(
        "bg-card ring-border inline-flex max-w-full items-center gap-2 rounded-2xl py-2 pr-3.5 pl-2 ring-1",
        "touch-manipulation",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        active && "ring-lime",
      )}
    >
      <AssistTextcon id={textcon} />
      <span className="min-w-0 text-left">
        <span className="block truncate text-[13px] font-medium tracking-tight">
          {option.plan.title}
        </span>
        {option.plan.subtitle ? (
          <span className="text-muted-foreground block truncate text-[12px]">
            {option.plan.subtitle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function AssistTyping() {
  return (
    <div
      className="-mx-2 mt-3 space-y-3"
      aria-busy="true"
      aria-label="Planning"
    >
      <div className="flex items-center gap-1.5 px-2 py-1">
        <span className="bg-lime size-1.5 animate-pulse rounded-full motion-reduce:animate-none" />
        <span className="bg-lime size-1.5 animate-pulse rounded-full delay-150 motion-reduce:animate-none" />
        <span className="bg-lime size-1.5 animate-pulse rounded-full delay-300 motion-reduce:animate-none" />
      </div>
      <div className="grid grid-cols-2 gap-2 px-2">
        <SkeletonTile />
        <SkeletonTile />
      </div>
    </div>
  );
}

function SkeletonTile() {
  return (
    <div className="bg-muted/50 flex min-h-[5.25rem] flex-col gap-2 rounded-2xl p-3">
      <span className="bg-muted size-6 animate-pulse rounded-full" />
      <span className="bg-muted h-3 w-20 animate-pulse rounded" />
      <span className="bg-muted h-2.5 w-14 animate-pulse rounded" />
    </div>
  );
}
