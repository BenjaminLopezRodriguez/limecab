import type { ReactNode } from "react";
import { Text, View } from "../platform/adapter";
import { radius, spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { continuousCorners } from "../style/corners.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * Whoever is carrying out the job: a person, their equipment, and the identifier you check
 * against reality. Deliberately about a *provider*, not a driver — the shape is the same for
 * anyone dispatched to a customer.
 *
 * The card stays neutral. `live` is the only accent here, and only when it means something: the
 * provider is under way right now.
 */
export function ProviderCard({
  name,
  detail,
  badge,
  meta,
  avatar,
  live,
}: {
  name: string;
  /** Secondary line — a vehicle, a job title, a team. */
  detail?: string;
  /** Right-aligned identifier: a plate, a unit number, an ID. */
  badge?: string;
  /** Appended to `detail` after a separator — a rating, an ETA. */
  meta?: string;
  /** Overrides the initial-letter placeholder. */
  avatar?: ReactNode;
  /** Marks the provider as active right now. */
  live?: boolean;
}) {
  const c = useLimeColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {live ? (
            <View
              aria-hidden
              style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: c.accent, flexShrink: 0 }}
            />
          ) : null}
          <Text numberOfLines={1} style={{ ...typeStyle(typography.bodyStrong), color: c.foreground, flexShrink: 1 }}>
            {name}
          </Text>
        </View>
        {detail || meta ? (
          <Text numberOfLines={1} style={{ ...typeStyle(typography.metadata), color: c.mutedForeground }}>
            {[detail, meta].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View
          style={{
            flexShrink: 0,
            paddingVertical: 4,
            paddingHorizontal: spacing.sm,
            borderRadius: radius.mapLabel,
            ...continuousCorners,
            backgroundColor: c.muted,
          }}
        >
          <Text style={{ ...typeStyle(typography.metadata), fontWeight: "600", letterSpacing: 0.78, color: c.foreground }}>
            {badge}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
