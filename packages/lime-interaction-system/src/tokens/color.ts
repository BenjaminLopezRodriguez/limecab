/**
 * Source: src/styles/globals.css:16-44 (light), :57-76 (dark).
 * Production defines these as oklch CSS variables; serialized here as strings a native
 * renderer can convert. Lime accent is the live-signal colour, used sparingly.
 */
export interface ColorScale { light: string; dark: string }

export const color = {
  canvas:          { light: "oklch(0.955 0.008 95)",  dark: "oklch(0.18 0.012 80)" },
  foreground:      { light: "oklch(0.205 0.012 85)",  dark: "oklch(0.97 0.008 95)" },
  panel:           { light: "oklch(0.985 0.006 95)",  dark: "oklch(0.24 0.012 80)" },
  muted:           { light: "oklch(0.935 0.012 95)",  dark: "oklch(0.28 0.012 80)" },
  mutedForeground: { light: "oklch(0.5 0.02 80)",     dark: "oklch(0.72 0.016 90)" },
  border:          { light: "oklch(0.9 0.01 90)",     dark: "oklch(1 0 0 / 12%)" },
  ring:            { light: "oklch(0.72 0.16 129)",   dark: "oklch(0.78 0.16 129)" },
  lime:            { light: "oklch(0.78 0.175 129)",  dark: "oklch(0.82 0.18 129)" },
  limeForeground:  { light: "oklch(0.22 0.06 130)",   dark: "oklch(0.18 0.05 130)" },
  accent:          { light: "oklch(0.945 0.045 129)", dark: "oklch(0.3 0.055 130)" },
  destructive:     { light: "oklch(0.577 0.245 27.325)", dark: "oklch(0.704 0.191 22.216)" },
} as const satisfies Record<string, ColorScale>;

/** Scrim over held surfaces. Source: ui/drawer.tsx:75. */
export const scrim = { opacity: 0.2, minOpacityWithSnapPoints: 0.5 } as const;
