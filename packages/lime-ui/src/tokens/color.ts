/**
 * Semantic colour roles.
 *
 * Components ask for a *role* — `accent`, not `lime` — so the kit is a neutral foundation with
 * a brand colour layered on top, rather than a green component library. Swap the brand and
 * every primitive follows; remove it and what is left still reads as a coherent interface.
 *
 * Values are hex because React Native's colour parser accepts hex, rgb/rgba and hsl, and
 * returns null for anything else. The original OKLCH authoring values are kept in comments:
 * they are the source of truth for the hue, and browsers understand them, but passing one to a
 * native style silently drops the property.
 */

export interface ColorRoles {
  /** The furthest-back plane. Surfaces sit on it. */
  background: string;
  /** Cards, sheets, panels — the plane content lives on. */
  surface: string;
  /** A surface lifted above another surface. */
  surfaceElevated: string;
  /** Primary text and the neutral dominant fill. */
  foreground: string;
  /** Quiet fills: wells, chips, tracks, skeletons. */
  muted: string;
  /** Secondary text on any neutral surface. */
  mutedForeground: string;
  /** Hairlines between and around surfaces. */
  border: string;
  /** The edge of an editable field. */
  input: string;
  /** The brand signal. Action emphasis, selection, live state — never decoration. */
  accent: string;
  /** Text and glyphs placed on `accent`. */
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
}

export interface Theme {
  light: ColorRoles;
  dark: ColorRoles;
}

/** The half of a theme a brand actually supplies. Everything else is the neutral foundation. */
export interface BrandAccent {
  light: Pick<ColorRoles, "accent" | "accentForeground">;
  dark: Pick<ColorRoles, "accent" | "accentForeground">;
}

/**
 * Warm neutrals. Barely off-grey — enough to feel like paper rather than a spec sheet, not
 * enough to tint. Typography and spacing carry the hierarchy; these just stay out of the way.
 */
const neutralLight = {
  background: "#F6F4F0", // oklch(0.955 0.008 95)
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  foreground: "#1A1815", // oklch(0.205 0.012 85)
  muted: "#EFEDE8", // oklch(0.935 0.012 95)
  mutedForeground: "#6B6660", // oklch(0.5 0.02 80)
  border: "#E4E1DB", // oklch(0.9 0.01 90)
  input: "#E4E1DB",
  destructive: "#E7000B", // oklch(0.577 0.245 27.325)
  destructiveForeground: "#FFFFFF",
} as const;

/**
 * Not an inversion. Dark mode gets its own ladder — background, surface, surfaceElevated are
 * three deliberate steps, because on a dark ground elevation has to be read from value alone.
 */
const neutralDark = {
  background: "#121110", // oklch(0.18 0.012 80)
  surface: "#1C1A17",
  surfaceElevated: "#26231F",
  foreground: "#F7F5EF", // oklch(0.97 0.008 95)
  muted: "#2C2924", // oklch(0.28 0.012 80)
  mutedForeground: "#A8A49A", // oklch(0.72 0.016 90)
  border: "#35312B",
  input: "#35312B",
  destructive: "#FF6467", // oklch(0.704 0.191 22.216)
  destructiveForeground: "#1A0808",
} as const;

/** Lime. Lifted slightly in dark so it stays the brightest thing on the screen. */
export const limeBrand: BrandAccent = {
  light: { accent: "#94CC43", accentForeground: "#112000" }, // oklch(0.78 0.175 129)
  dark: { accent: "#9FDA4D", accentForeground: "#0A1600" }, // oklch(0.82 0.18 129)
};

/** Neutral foundation + a brand accent = a theme. */
export function createTheme(brand: BrandAccent): Theme {
  return {
    light: { ...neutralLight, ...brand.light },
    dark: { ...neutralDark, ...brand.dark },
  };
}

/** The default theme this kit ships. Any other brand is `createTheme(...)`. */
export const limeTheme: Theme = createTheme(limeBrand);

/** Scrim over held surfaces. Opacity, not colour — it works over either scheme. */
export const scrim = { opacity: 0.2, minOpacityWithSnapPoints: 0.5 } as const;
