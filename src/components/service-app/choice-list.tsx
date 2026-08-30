"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Default pick-one list. Full-bleed to the padded sheet / interrupt body
 * (`px-5` / `md:px-6`) — no ring, no rounded group, no dividers. Rows paint
 * the hover themselves. Ride select is the reference.
 */
export function ChoiceList({
  className,
  children,
  ...props
}: ComponentProps<"ul">) {
  return (
    <ul className={cn("-mx-5 flex flex-col md:-mx-6", className)} {...props}>
      {children}
    </ul>
  );
}

export function ChoiceRow({
  className,
  selected,
  children,
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  const radio = props.role === "radio";
  return (
    <li>
      <button
        type={type}
        {...props}
        aria-pressed={radio || selected === undefined ? undefined : selected}
        className={cn(
          "relative flex w-full items-center gap-3 overflow-hidden px-5 py-3 text-left md:px-6",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          selected
            ? "bg-accent before:bg-foreground before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']"
            : "hover:bg-accent/60 active:bg-accent",
          className,
        )}
      >
        {children}
      </button>
    </li>
  );
}

/** Read-only row — same shell as ChoiceRow, for lists that are not pickers yet. */
export function ChoiceStaticRow({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  return (
    <li>
      <div
        className={cn(
          "flex w-full items-center gap-3 px-5 py-3 md:px-6",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </li>
  );
}

/** Navigable row — same hover shell as ChoiceRow, for drill-in lists. */
export function ChoiceLinkRow({
  className,
  selected,
  children,
  ...props
}: ComponentProps<typeof Link> & { selected?: boolean }) {
  return (
    <li>
      <Link
        {...props}
        className={cn(
          "relative flex w-full items-center gap-3 overflow-hidden px-5 py-3 text-left md:px-6",
          "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
          selected
            ? "bg-accent before:bg-foreground before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']"
            : "hover:bg-accent/60 active:bg-accent",
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}

export function ChoiceGlyph({
  children,
  selected = false,
  className,
}: {
  children: ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-2xl [&_svg]:size-6",
        selected ? "bg-lime text-lime-foreground" : "bg-muted text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ChoiceCopy({
  title,
  detail,
  className,
}: {
  title: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("min-w-0 flex-1", className)}>
      <span className="block truncate text-[17px] font-semibold tracking-tight">
        {title}
      </span>
      {detail ? (
        <span className="text-muted-foreground mt-0.5 block truncate text-sm">
          {detail}
        </span>
      ) : null}
    </span>
  );
}
