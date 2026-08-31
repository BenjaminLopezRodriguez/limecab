import type { CSSProperties } from "react";
import type { PresentationEnvironment } from "../policy/environment.ts";

/** Canonical Storybook viewport presets. */
export const VIEWPORTS = {
  mobile: { width: 390, height: 844, label: "390×844" },
  mobileLarge: { width: 430, height: 932, label: "430×932" },
  tablet: { width: 768, height: 1024, label: "768×1024" },
  desktop: { width: 1280, height: 800, label: "1280×800" },
  desktopWide: { width: 1440, height: 900, label: "1440×900" },
} as const;

export const FONT_SCALES = [1, 1.25, 1.5, 2] as const;

export type DesignLabOverrides = {
  spacingMultiplier: number;
  headlineScale: number;
  bodyScale: number;
  sheetRadius: number;
  ctaHeight: number;
  surfacePadding: number;
  maxPanelWidth: number;
  motionDurationMultiplier: number;
  reducedMotion: boolean;
  fontScale: number;
  showOcclusion: boolean;
};

export const DEFAULT_LAB_OVERRIDES: DesignLabOverrides = {
  spacingMultiplier: 1,
  headlineScale: 1,
  bodyScale: 1,
  sheetRadius: 1,
  ctaHeight: 1,
  surfacePadding: 1,
  maxPanelWidth: 1,
  motionDurationMultiplier: 1,
  reducedMotion: false,
  fontScale: 1,
  showOcclusion: false,
};

export function envFromGlobals(globals: Record<string, unknown>): PresentationEnvironment {
  const vpKey = (globals.viewport as keyof typeof VIEWPORTS) ?? "mobile";
  const vp = VIEWPORTS[vpKey] ?? VIEWPORTS.mobile;
  const fontScale = Number(globals.fontScale ?? 1);
  const keyboardVisible = Boolean(globals.keyboardVisible);
  return {
    safeArea: { top: 59, right: 0, bottom: 34, left: 0 },
    viewport: { width: vp.width, height: vp.height },
    keyboard: { visible: keyboardVisible, height: keyboardVisible ? 320 : 0 },
    reducedMotion: Boolean(globals.reducedMotion),
    fontScale,
  };
}

export function scaledStyle(base: CSSProperties, fontScale: number): CSSProperties {
  if (fontScale === 1) return base;
  const out = { ...base };
  if (typeof out.fontSize === "number") out.fontSize = out.fontSize * fontScale;
  if (typeof out.lineHeight === "number") out.lineHeight = out.lineHeight * fontScale;
  return out;
}
