import { Text, View } from "../platform/adapter";
import { radius, spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

export interface RouteStop {
  label: string;
  detail?: string;
}

/**
 * Origin → stops → destination, read top to bottom.
 *
 * The accent marks the point you are travelling *from* — the live end of the route. Everything
 * onward is neutral, and the destination is a squared foreground mark, so where the route ends
 * is legible without reading a word of it.
 */
export function RouteRail({ stops }: { stops: readonly RouteStop[] }) {
  const c = useLimeColors();
  return (
    <View role="list" style={{ gap: spacing.md }}>
      {stops.map((stop, i) => {
        const last = i === stops.length - 1;
        const first = i === 0;
        return (
          <View key={`${stop.label}-${i}`} style={{ flexDirection: "row", gap: spacing.md }}>
            <View aria-hidden style={{ alignItems: "center", paddingTop: 4 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: last ? 2 : radius.pill,
                  backgroundColor: last ? c.foreground : first ? c.accent : c.mutedForeground,
                }}
              />
              {!last ? (
                <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: c.border, marginTop: 4 }} />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ ...typeStyle(typography.body), color: c.foreground }}>
                {stop.label}
              </Text>
              {stop.detail ? (
                <Text numberOfLines={1} style={{ ...typeStyle(typography.metadata), color: c.mutedForeground }}>
                  {stop.detail}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
