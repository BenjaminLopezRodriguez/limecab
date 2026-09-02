/**
 * Compatibility shim for the lab's web renderer.
 *
 * `@lime/ui` now exposes semantic colour *roles* — `accent`, not `lime` — so that the kit is a
 * neutral foundation with a brand layered on, and so a consuming app can swap the brand without
 * every primitive knowing about it. The lab's own web components still speak the old palette
 * names; this maps them onto the new roles so the cutover stays one commit.
 *
 * @deprecated New lab code should call `useLimeColors()` from `@lime/ui`.
 */
import { limeTheme } from "@lime/ui/tokens";

export interface ColorScale {
  light: string;
  dark: string;
}

const pair = (role: keyof (typeof limeTheme)["light"]): ColorScale => ({
  light: limeTheme.light[role],
  dark: limeTheme.dark[role],
});

export const color = {
  canvas: pair("background"),
  panel: pair("surface"),
  foreground: pair("foreground"),
  muted: pair("muted"),
  mutedForeground: pair("mutedForeground"),
  border: pair("border"),
  input: pair("input"),
  lime: pair("accent"),
  limeForeground: pair("accentForeground"),
  /** Was a pale green wash. Now neutral — selection is signalled by an accent mark, not a tint. */
  accent: pair("muted"),
  ring: pair("accent"),
  destructive: pair("destructive"),
} as const satisfies Record<string, ColorScale>;
