import type { ReactNode } from "react";
import { Text, View } from "../platform/adapter";
import { radius, spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { continuousCorners } from "../style/corners.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * Who — or what — to look for. The middle band of a live surface: the badge is the thing you
 * check against reality at arm's length, so it outranks the name typographically and the name
 * confirms it.
 *
 * Entirely neutral. Recognition is not an action, and nothing here competes with the dock.
 */
export function LiveSheetIdentity({
  name,
  badge,
  detail,
  avatar,
}: {
  name: string;
  /** The glanceable identifier — a plate, a unit number, a door code. */
  badge?: string;
  detail?: string;
  /** Overrides the initial-letter placeholder. */
  avatar?: ReactNode;
}) {
  const c = useLimeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View
        aria-hidden
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: radius.pill,
          backgroundColor: c.muted,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {avatar ?? <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>{name.charAt(0)}</Text>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {badge ? (
          <View
            style={{
              alignSelf: "flex-start",
              paddingVertical: 4,
              paddingHorizontal: spacing.sm,
              marginBottom: 4,
              borderRadius: radius.mapLabel,
              ...continuousCorners,
              backgroundColor: c.muted,
            }}
          >
            <Text
              numberOfLines={1}
              style={{ ...typeStyle(typography.metadata), fontWeight: "600", letterSpacing: 0.78, color: c.foreground }}
            >
              {badge}
            </Text>
          </View>
        ) : null}
        <Text numberOfLines={1} style={{ ...typeStyle(typography.body), color: c.mutedForeground }}>
          {name}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={{ ...typeStyle(typography.body), marginTop: 2, color: c.mutedForeground }}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
