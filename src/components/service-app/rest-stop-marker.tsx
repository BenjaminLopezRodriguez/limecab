"use client";

import { cn } from "@/lib/utils";

/**
 * Highway rest / coffee stamp. Sits on the point — square, no stem —
 * so it is never the pin being placed.
 */
export function RestStopMarker({
  label,
  selected = false,
  category = "rest_area",
  onSelect,
}: {
  label: string;
  selected?: boolean;
  category?: string;
  onSelect?: () => void;
}) {
  const stamp = (
    <span
      className={cn(
        "grid place-items-center rounded-[5px] ring-1",
        selected
          ? "bg-lime text-lime-foreground size-6 ring-lime-foreground/25"
          : "bg-card text-foreground size-5 ring-border",
        "transition-transform duration-150 motion-reduce:transition-none",
        selected && "scale-110",
      )}
    >
      {category === "coffee" ? <CoffeeGlyph /> : <ShelterGlyph />}
    </span>
  );

  const inner = (
    <>
      {stamp}
      {selected ? (
        <span className="bg-card/95 ring-border pointer-events-none absolute left-[calc(50%+14px)] max-w-[7rem] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-tight ring-1">
          {label}
        </span>
      ) : null}
    </>
  );

  const className = cn(
    "relative flex size-11 items-center justify-center",
    onSelect &&
      "focus-visible:ring-ring cursor-pointer rounded-md touch-manipulation focus-visible:ring-2 focus-visible:outline-none",
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={selected}
        onClick={onSelect}
        onPointerDown={(event) => event.stopPropagation()}
        className={className}
      >
        {inner}
      </button>
    );
  }

  return (
    <span role="img" aria-label={label} className={className}>
      {inner}
    </span>
  );
}

function CoffeeGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.5 6.5h7v4.2A2.3 2.3 0 0 1 8.2 13H5.8A2.3 2.3 0 0 1 3.5 10.7Z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        d="M10.5 7.4h1.35a1.35 1.35 0 0 1 0 2.7H10.5"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        d="M5.6 3.1c.05.7-.35 1.1-.35 1.9M7.8 2.8c.08.8-.28 1.2-.28 2.05"
      />
    </svg>
  );
}

function ShelterGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.4 8.1 8 3.4l5.6 4.7M5.2 8.1v5M10.8 8.1v5M4.2 11.4h7.6"
      />
    </svg>
  );
}
