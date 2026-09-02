import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ColorScheme } from "@lime/ui";

/**
 * A development control, not product state: it lets the proving ground demonstrate light, dark
 * and system-following without three builds. `undefined` means follow the OS.
 */
interface ThemeChoice {
  scheme: ColorScheme | undefined;
  cycle: () => void;
  label: string;
}

const Ctx = createContext<ThemeChoice | null>(null);

const ORDER: (ColorScheme | undefined)[] = [undefined, "light", "dark"];
const LABEL = { undefined: "System", light: "Light", dark: "Dark" } as const;

export function ThemeChoiceProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);
  const scheme = ORDER[index % ORDER.length];
  const value = useMemo<ThemeChoice>(
    () => ({
      scheme,
      cycle: () => setIndex((i) => (i + 1) % ORDER.length),
      label: LABEL[String(scheme) as keyof typeof LABEL],
    }),
    [scheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useThemeChoice(): ThemeChoice {
  const value = useContext(Ctx);
  if (!value) throw new Error("useThemeChoice must be used inside ThemeChoiceProvider");
  return value;
}
