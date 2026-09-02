import { Pressable, Text, View } from "../platform/adapter";
import { elevation, radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { boxShadow } from "../style/shadow.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * A compact itinerary floating over a canvas: a decision already made, tappable to revise.
 * Entirely neutral — the route is settled, so nothing here is live state.
 */
export function MapRouteBar({
  origin,
  destination,
  onBack,
  onEdit,
}: {
  origin: string;
  /** Omit for a single centred location label. */
  destination?: string;
  onBack?: () => void;
  onEdit?: () => void;
}) {
  const c = useLimeColors();
  const bar = surface.minHitTarget;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: bar,
        borderRadius: radius.pill,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        paddingLeft: onBack ? 2 : spacing.md,
        paddingRight: spacing.md,
        ...boxShadow(elevation.floatingControl),
      }}
    >
      {onBack ? (
        <Pressable
          role="button"
          aria-label="Back"
          onPress={onBack}
          style={{
            width: bar,
            height: bar,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
          }}
        >
          <Text style={{ fontSize: 22, color: c.foreground }}>‹</Text>
        </Pressable>
      ) : null}
      <Pressable
        role="button"
        aria-label={destination ? `${origin} to ${destination}` : origin}
        disabled={!onEdit}
        onPress={onEdit}
        style={{
          flex: 1,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: destination ? "flex-start" : "center",
          gap: spacing.sm,
          paddingRight: destination || !onBack ? 0 : bar,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...typeStyle(typography.metadata),
            color: destination ? c.mutedForeground : c.foreground,
            fontWeight: destination ? "500" : "600",
            flexShrink: 1,
          }}
        >
          {origin}
        </Text>
        {destination ? (
          <>
            <Text aria-hidden style={{ color: c.mutedForeground, flexShrink: 0 }}>
              ›
            </Text>
            <Text
              numberOfLines={1}
              style={{ ...typeStyle(typography.metadata), fontWeight: "600", color: c.foreground, flexShrink: 1 }}
            >
              {destination}
            </Text>
          </>
        ) : null}
      </Pressable>
    </View>
  );
}
