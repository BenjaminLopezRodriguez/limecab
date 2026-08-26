"use client";

import type { ComponentProps } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";

import { cn } from "@/lib/utils";

export type AppIcon = IconSvgElement;

/**
 * App-wide Hugeicons renderer. Size, color, and stroke live here so every
 * screen draws the same weight — 1.5 stroke, currentColor, 20px default.
 */
export function Icon({
  icon,
  size = 20,
  strokeWidth = 1.5,
  color = "currentColor",
  className,
  ...rest
}: Omit<ComponentProps<typeof HugeiconsIcon>, "icon"> & {
  icon: IconSvgElement;
}) {
  return (
    <HugeiconsIcon
      icon={icon}
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}
