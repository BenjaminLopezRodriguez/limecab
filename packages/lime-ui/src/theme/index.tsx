import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "../platform/adapter";
import { limeTheme, type ColorRoles, type Theme } from "../tokens/color.ts";

export type ColorScheme = "light" | "dark";

export interface LimeTheme {
  colors: ColorRoles;
  scheme: ColorScheme;
}

const ThemeContext = createContext<LimeTheme | null>(null);

/**
 * Optional. Without it every component follows the OS scheme with the Lime theme, which is
 * what a greenfield app wants; wrap a tree in this only to force a scheme or swap the brand.
 */
export function LimeThemeProvider({
  theme = limeTheme,
  scheme,
  children,
}: {
  theme?: Theme;
  /** Omit to follow the OS. */
  scheme?: ColorScheme;
  children?: ReactNode;
}) {
  const osScheme = useColorScheme();
  const resolved = scheme ?? osScheme;
  const value = useMemo<LimeTheme>(() => ({ colors: theme[resolved], scheme: resolved }), [theme, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The resolved theme — the provider's, or the OS scheme against the default Lime theme. */
export function useLimeTheme(): LimeTheme {
  const provided = useContext(ThemeContext);
  const osScheme = useColorScheme();
  const fallback = useMemo<LimeTheme>(() => ({ colors: limeTheme[osScheme], scheme: osScheme }), [osScheme]);
  return provided ?? fallback;
}

/** What components actually reach for. */
export function useLimeColors(): ColorRoles {
  return useLimeTheme().colors;
}
