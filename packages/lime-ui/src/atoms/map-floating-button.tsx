import type { ReactNode } from "react";
import { Pressable } from "../platform/adapter";
import { elevation, radius, surface } from "../tokens/index.ts";
import { boxShadow } from "../style/shadow.ts";
import { useLimeColors } from "../theme/index.tsx";
import { IconGlyph } from "./icon-glyph.tsx";

/**
 * A circular control floating over a canvas — the one place the kit spends a shadow. Neutral at
 * rest; `active` means this control is currently doing something (following, recording, locked
 * on) and that is worth the accent.
 */
export function MapFloatingButton({
  label,
  children,
  active,
  onPress,
}: {
  label: string;
  children?: ReactNode;
  active?: boolean;
  onPress?: () => void;
}) {
  const c = useLimeColors();
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-checked={active}
      onPress={onPress}
      style={{
        width: surface.minHitTarget,
        height: surface.minHitTarget,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? c.accent : c.border,
        backgroundColor: active ? c.accent : c.surface,
        alignItems: "center",
        justifyContent: "center",
        ...boxShadow(elevation.floatingControl),
      }}
    >
      <IconGlyph color={active ? c.accentForeground : c.foreground}>{children}</IconGlyph>
    </Pressable>
  );
}
