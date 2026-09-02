import type { ReactNode } from "react";
import { Pressable, Text, View } from "../platform/adapter";
import { radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * The thumb zone. One wide, quiet control takes the remaining width and the icon-sized ones sit
 * beside it, every control on the same muted fill so the row reads as one band rather than a
 * scatter of buttons.
 *
 * No accent here on purpose: the dock is where secondary actions live, and a surface's one
 * accented action belongs to `PrimaryAction`.
 */
export function LiveSheetDock({
  label,
  onPress,
  actions,
}: {
  /** Text of the wide control. Omit it, with `onPress`, for an actions-only dock. */
  label?: string;
  onPress?: () => void;
  /** Fixed-width controls beside the fill — usually `Button size="icon"`. */
  actions?: ReactNode;
}) {
  const c = useLimeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {onPress ? (
        <Pressable
          role="button"
          aria-label={label}
          onPress={onPress}
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            height: surface.cta.default,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: c.muted,
          }}
        >
          <Text numberOfLines={1} style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>
            {label}
          </Text>
        </Pressable>
      ) : null}
      {actions}
    </View>
  );
}
