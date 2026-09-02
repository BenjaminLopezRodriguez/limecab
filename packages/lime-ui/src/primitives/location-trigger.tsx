import type { ReactNode } from "react";
import { Pressable, Text, View } from "../platform/adapter";
import { elevation, radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { boxShadow } from "../style/shadow.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * Expresses intent. It reads as a field but behaves as a button — tapping opens a search
 * surface rather than raising a keyboard in place, which is why it is deliberately not a real
 * text input. The accent dot is the one spot of colour: it stands for where you are now.
 *
 * `start` replaces that dot when the leading mark should mean something else. `end` is a slot
 * for a control that belongs *inside* the trigger rather than beside it — a mic, a map pin —
 * and it is a sibling of the pressable text, not nested inside it, so its own tap target stays
 * its own.
 */
export function LocationTrigger({
  placeholder = "Where to?",
  value,
  onPress,
  start,
  end,
  size = "lg",
}: {
  placeholder?: string;
  value?: string;
  onPress?: () => void;
  /** Leading node. Defaults to the accent position dot. */
  start?: ReactNode;
  /** Trailing control, kept outside the pressable so it can be pressed separately. */
  end?: ReactNode;
  size?: "default" | "lg";
}) {
  const c = useLimeColors();
  const height = size === "lg" ? surface.cta.lg : surface.cta.default;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        height,
        paddingRight: end ? spacing.sm : 0,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface,
        ...boxShadow(elevation.floatingControl),
      }}
    >
      <Pressable
        role="button"
        aria-label={value ?? placeholder}
        onPress={onPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          flex: 1,
          minWidth: 0,
          height: "100%",
          paddingHorizontal: spacing.xl,
        }}
      >
        {start ?? (
          <View
            aria-hidden
            style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: c.accent, flexShrink: 0 }}
          />
        )}
        <Text
          numberOfLines={1}
          style={{
            ...typeStyle(typography.bodyStrong),
            flex: 1,
            minWidth: 0,
            color: value ? c.foreground : c.mutedForeground,
          }}
        >
          {value ?? placeholder}
        </Text>
      </Pressable>
      {end ? <View style={{ flexShrink: 0 }}>{end}</View> : null}
    </View>
  );
}
