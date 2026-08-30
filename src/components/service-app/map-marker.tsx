"use client";

import type { ReactNode } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Uber Base Web map-marker visuals, rebuilt with LimeCab tokens.
 * Not a `baseui` wrapper — same shapes (Fixed / Floating / Route / Puck /
 * Needle) so Mapbox HTML markers stay geographically anchored.
 */

export const NEEDLE_HEIGHT = {
  none: 0,
  short: 4,
  medium: 12,
  tall: 20,
} as const;

export type MarkerKind = "default" | "accent" | "negative";
export type NeedleSize = keyof typeof NEEDLE_HEIGHT;
export type PinheadSize =
  | "xx-small-circle"
  | "xx-small-square"
  | "x-small-circle"
  | "x-small-square"
  | "small"
  | "medium"
  | "large";
export type FloatingMarkerSize = "small" | "medium" | "large";
export type FloatingAnchor =
  | "none"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";
export type FloatingAnchorType =
  | "circle"
  | "square"
  | "xx-small-circle"
  | "xx-small-square";
export type RouteAnchor =
  | "top-left"
  | "top-center"
  | "top-right"
  | "right-center"
  | "bottom-right"
  | "bottom-center"
  | "bottom-left"
  | "left-center";
export type LocationPuckType = "consumer" | "earner";
export type LocationPuckSize = "small" | "medium" | "large";
export type LabelEnhancerPosition = "top" | "bottom" | "left" | "right";

const kindSurface = cva("", {
  variants: {
    kind: {
      default: "bg-foreground text-background",
      accent: "bg-lime text-lime-foreground",
      negative: "bg-destructive text-white",
    },
  },
  defaultVariants: { kind: "default" },
});

const pinheadSize = cva(
  "relative grid grid-flow-col items-center gap-2 whitespace-nowrap shadow-[0_2px_8px_rgba(0,0,0,0.28)]",
  {
    variants: {
      size: {
        small: "h-6 px-3 text-[12px] leading-none font-semibold",
        medium: "h-9 px-3 text-[13px] leading-none font-semibold",
        large: "h-12 px-3.5 text-[15px] leading-none font-semibold",
      },
      variant: {
        fixed: "rounded-full",
        floating: "rounded-md px-2",
      },
    },
    defaultVariants: { size: "medium", variant: "fixed" },
  },
);

function isCompact(size: PinheadSize) {
  return (
    size === "xx-small-circle" ||
    size === "xx-small-square" ||
    size === "x-small-circle" ||
    size === "x-small-square"
  );
}

function isRound(size: PinheadSize | FloatingAnchorType) {
  return size.includes("circle") || size === "circle";
}

function compactOuter(size: PinheadSize | FloatingAnchorType) {
  if (size.startsWith("xx-small") || size === "xx-small-circle" || size === "xx-small-square") {
    return "size-2";
  }
  if (size === "circle" || size === "square") return "size-4";
  return "size-4";
}

function compactInner(size: PinheadSize | FloatingAnchorType) {
  if (size.startsWith("xx-small")) return "size-1";
  if (size === "circle" || size === "square") return "size-1.5";
  return "size-1.5";
}

/** Needle under a fixed pinhead. Tip is the geographic point. */
export function Needle({
  size = "short",
  kind = "accent",
  className,
}: {
  size?: NeedleSize;
  kind?: MarkerKind;
  className?: string;
}) {
  const height = NEEDLE_HEIGHT[size];
  if (height === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block w-1 shrink-0 shadow-[0_2px_6px_rgba(0,0,0,0.28)]",
        kindSurface({ kind }),
        className,
      )}
      style={{ height }}
    />
  );
}

function CompactAnchor({
  size,
  kind,
  className,
}: {
  size: PinheadSize | FloatingAnchorType;
  kind: MarkerKind;
  className?: string;
}) {
  const round = isRound(size);
  return (
    <span
      className={cn(
        "relative flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.28)] ring-2 ring-card",
        compactOuter(size),
        kindSurface({ kind }),
        round ? "rounded-full" : "rounded-[2px]",
        className,
      )}
    >
      <span
        className={cn(
          "bg-card block",
          compactInner(size),
          round ? "rounded-full" : "rounded-[1px]",
        )}
      />
    </span>
  );
}

function PinHead({
  label,
  secondaryLabel,
  size = "medium",
  kind = "accent",
  variant = "fixed",
  startEnhancer,
  endEnhancer,
  className,
}: {
  label?: ReactNode;
  secondaryLabel?: ReactNode;
  size?: Extract<PinheadSize, "small" | "medium" | "large">;
  kind?: MarkerKind;
  variant?: "fixed" | "floating";
  startEnhancer?: ReactNode;
  endEnhancer?: ReactNode;
  className?: string;
}) {
  const icon = size === "large" ? "size-6" : "size-4";
  const twoLine = Boolean(secondaryLabel);
  return (
    <span
      className={cn(
        pinheadSize({ size, variant }),
        kindSurface({ kind }),
        twoLine && size === "medium" && "text-[12px]",
        twoLine && size === "large" && "text-[13px]",
        !label && "aspect-square justify-center px-0",
        className,
      )}
    >
      {startEnhancer ? (
        <span className={cn("flex items-center justify-center", icon)}>
          {startEnhancer}
        </span>
      ) : null}
      {label ? (
        <span className="flex min-w-0 flex-col justify-center">
          <span className="max-w-[10rem] truncate">{label}</span>
          {secondaryLabel ? (
            <span className="max-w-[10rem] truncate font-medium opacity-70">
              {secondaryLabel}
            </span>
          ) : null}
        </span>
      ) : null}
      {endEnhancer ? (
        <span className={cn("flex items-center justify-center", icon)}>
          {endEnhancer}
        </span>
      ) : null}
    </span>
  );
}

function LabelEnhancer({ children }: { children: ReactNode }) {
  return (
    <span className="bg-card text-foreground max-w-[10rem] truncate rounded-md px-1.5 py-0.5 text-[11px] leading-none font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.28)]">
      {children}
    </span>
  );
}

/**
 * Pin pushed into the map: pinhead + optional needle. The needle tip is the
 * bottom-center of this box — Mapbox `anchor="bottom"` (not a 0×0 origin,
 * which Mapbox clips under a CSS transform).
 */
export function FixedMarker({
  label,
  size = "medium",
  needle = "short",
  kind = "accent",
  dragging = false,
  startEnhancer,
  endEnhancer,
  labelEnhancerContent,
  labelEnhancerPosition = "top",
  className,
}: {
  label?: ReactNode;
  size?: PinheadSize;
  needle?: NeedleSize;
  kind?: MarkerKind;
  dragging?: boolean;
  startEnhancer?: ReactNode;
  endEnhancer?: ReactNode;
  labelEnhancerContent?: ReactNode;
  labelEnhancerPosition?: LabelEnhancerPosition;
  className?: string;
}) {
  const compact = isCompact(size);
  const enhancer = labelEnhancerContent ? (
    <LabelEnhancer>{labelEnhancerContent}</LabelEnhancer>
  ) : null;
  const pinColumn = (
    <span
      className={cn(
        "relative flex flex-col items-center",
        "transition-transform duration-200 ease-out motion-reduce:transition-none",
        dragging && "-translate-y-1.5",
      )}
    >
      {compact ? (
        <CompactAnchor size={size} kind={kind} />
      ) : (
        <PinHead
          label={label}
          size={size}
          kind={kind}
          variant="fixed"
          startEnhancer={startEnhancer}
          endEnhancer={endEnhancer}
        />
      )}
      <Needle size={needle} kind={kind} />
      <span
        aria-hidden="true"
        className={cn(
          "absolute bottom-0 left-1/2 h-1 w-1.5 -translate-x-1/2 rounded-full",
          kindSurface({ kind }),
          "transition-opacity duration-200 motion-reduce:transition-none",
          dragging ? "opacity-70" : "opacity-0",
        )}
      />
    </span>
  );

  if (!enhancer) {
    return (
      <span className={cn("relative inline-flex flex-col items-center", className)}>
        {pinColumn}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "relative inline-grid grid-cols-[1fr_auto_1fr] items-end justify-items-center gap-x-1",
        className,
      )}
    >
      {labelEnhancerPosition === "top" ? (
        <span className="col-span-3 mb-0.5">{enhancer}</span>
      ) : null}
      {labelEnhancerPosition === "left" ? enhancer : <span />}
      {pinColumn}
      {labelEnhancerPosition === "right" ? enhancer : <span />}
      {labelEnhancerPosition === "bottom" ? (
        <span className="col-span-3 mt-0.5">{enhancer}</span>
      ) : null}
    </span>
  );
}

function floatingPinheadTransform(anchor: FloatingAnchor, px: number) {
  return {
    none: "",
    "top-left": `translate(${px}px, ${px}px)`,
    "top-right": `translate(-100%, ${px}px)`,
    "bottom-left": `translate(${px}px, -100%)`,
    "bottom-right": `translate(-100%, -100%)`,
  }[anchor];
}

export function FloatingMarker({
  label,
  secondaryLabel,
  size = "medium",
  kind = "default",
  anchor = "bottom-left",
  anchorType = "circle",
  startEnhancer,
  endEnhancer,
  className,
}: {
  label?: ReactNode;
  secondaryLabel?: ReactNode;
  size?: FloatingMarkerSize;
  kind?: MarkerKind;
  anchor?: FloatingAnchor;
  anchorType?: FloatingAnchorType;
  startEnhancer?: ReactNode;
  endEnhancer?: ReactNode;
  className?: string;
}) {
  const xx = anchorType.startsWith("xx-small");
  const anchorPx = xx ? 8 : 16;
  return (
    <span className={cn("relative inline-flex", xx ? "size-2" : "size-4", className)}>
      {anchor !== "none" ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <CompactAnchor size={anchorType} kind={kind} />
        </span>
      ) : null}
      {label || startEnhancer || endEnhancer ? (
        <span
          className="absolute top-0 left-0"
          style={{
            transform:
              anchor === "none"
                ? label
                  ? "translate(-50%, -100%)"
                  : "translate(-50%, -50%)"
                : floatingPinheadTransform(anchor, anchorPx),
          }}
        >
          <PinHead
            label={label}
            secondaryLabel={secondaryLabel}
            size={size}
            kind={kind}
            variant="floating"
            startEnhancer={startEnhancer}
            endEnhancer={endEnhancer}
          />
        </span>
      ) : null}
    </span>
  );
}

const ROUTE_POINTER: Record<
  RouteAnchor,
  { path: string; viewBox: string; className: string }
> = {
  "top-left": {
    path: "M0 0L24 8L8 24L0 0Z",
    viewBox: "0 0 24 24",
    className: "top-0 left-0 h-6 w-6 -translate-x-1/3 -translate-y-1/3",
  },
  "top-right": {
    path: "M24 0L0 8L16 24L24 0Z",
    viewBox: "0 0 24 24",
    className: "top-0 right-0 h-6 w-6 translate-x-1/3 -translate-y-1/3",
  },
  "top-center": {
    path: "M8.5 0L0.5 8H16.5L8.5 0Z",
    viewBox: "0 0 17 8",
    className: "top-0 left-1/2 h-2 w-[17px] -translate-x-1/2 -translate-y-full",
  },
  "bottom-left": {
    path: "M0 24L24 16L8 0L0 24Z",
    viewBox: "0 0 24 24",
    className: "bottom-0 left-0 h-6 w-6 -translate-x-1/3 translate-y-1/3",
  },
  "bottom-right": {
    path: "M24 24L0 16L16 0L24 24Z",
    viewBox: "0 0 24 24",
    className: "right-0 bottom-0 h-6 w-6 translate-x-1/3 translate-y-1/3",
  },
  "bottom-center": {
    path: "M8 8L16 0H0L8 8Z",
    viewBox: "0 0 16 8",
    className: "bottom-0 left-1/2 h-2 w-4 -translate-x-1/2 translate-y-full",
  },
  "left-center": {
    path: "M0 8L8 16V0L0 8Z",
    viewBox: "0 0 8 16",
    className: "top-1/2 left-0 h-4 w-2 -translate-x-full -translate-y-1/2",
  },
  "right-center": {
    path: "M8 8L0 0V16L8 8Z",
    viewBox: "0 0 8 16",
    className: "top-1/2 left-full h-4 w-2 -translate-y-1/2",
  },
};

export function FloatingRouteMarker({
  label,
  secondaryLabel,
  selected = false,
  anchor = "bottom-center",
  startEnhancer,
  endEnhancer,
  className,
}: {
  label?: ReactNode;
  secondaryLabel?: ReactNode;
  selected?: boolean;
  anchor?: RouteAnchor;
  startEnhancer?: ReactNode;
  endEnhancer?: ReactNode;
  className?: string;
}) {
  const pointer = ROUTE_POINTER[anchor];
  return (
    <span
      className={cn(
        "relative inline-grid grid-flow-col items-center gap-2 rounded-lg px-2 py-1 text-[12px] leading-none font-semibold tracking-wide whitespace-nowrap uppercase shadow-[0_2px_8px_rgba(0,0,0,0.28)]",
        selected
          ? "bg-foreground text-background"
          : "bg-card text-foreground",
        className,
      )}
    >
      {startEnhancer ? (
        <span className="flex size-3 items-center justify-center [&_svg]:size-3">
          {startEnhancer}
        </span>
      ) : null}
      <span className="flex flex-col">
        <span>{label}</span>
        {secondaryLabel ? (
          <span className="mt-0.5 font-medium normal-case opacity-70">
            {secondaryLabel}
          </span>
        ) : null}
      </span>
      {endEnhancer ? (
        <span className="flex size-3 items-center justify-center [&_svg]:size-3">
          {endEnhancer}
        </span>
      ) : null}
      <svg
        aria-hidden="true"
        viewBox={pointer.viewBox}
        className={cn("absolute", pointer.className)}
      >
        <path
          d={pointer.path}
          className={selected ? "fill-foreground" : "fill-card"}
        />
      </svg>
    </span>
  );
}

const PUCK_SCALE = { small: 0.5, medium: 0.75, large: 1 } as const;

export function LocationPuck({
  type = "consumer",
  size = "medium",
  heading,
  showHeading,
  confidenceRadius,
  className,
}: {
  type?: LocationPuckType;
  size?: LocationPuckSize;
  heading?: number;
  showHeading?: boolean;
  confidenceRadius?: number;
  className?: string;
}) {
  const cone = showHeading ?? heading !== undefined;
  const radius = confidenceRadius ?? (type === "consumer" ? 36 : 0);

  if (type === "earner") {
    const scale = PUCK_SCALE[size];
    return (
      <span
        className={cn(
          "relative flex items-center justify-center",
          className,
        )}
        style={{ width: 72 * scale, height: 72 * scale }}
      >
        {radius > 0 ? (
          <span
            aria-hidden="true"
            className="bg-lime/15 absolute rounded-full"
            style={{ width: radius, height: radius }}
          />
        ) : null}
        <span
          className="border-lime bg-card absolute rounded-full border-[6px] shadow-[0_3px_5px_rgba(0,0,0,0.35)]"
          style={{
            width: 72 * scale,
            height: 72 * scale,
            transform: heading !== undefined ? `rotate(${heading}deg)` : undefined,
          }}
        />
      </span>
    );
  }

  return (
    <span
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: Math.max(16, radius), height: Math.max(16, radius) }}
    >
      {radius > 0 ? (
        <span
          aria-hidden="true"
          className="bg-lime/20 absolute rounded-full"
          style={{ width: radius, height: radius }}
        />
      ) : null}
      {cone ? (
        <span
          aria-hidden="true"
          className="absolute"
          style={{ transform: `rotate(${heading ?? 0}deg)` }}
        >
          <span className="-mt-3 block size-0 border-r-[6px] border-b-[10px] border-l-[6px] border-r-transparent border-b-lime/70 border-l-transparent" />
        </span>
      ) : null}
      <span className="bg-lime relative size-3 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.28)] ring-2 ring-card" />
    </span>
  );
}
