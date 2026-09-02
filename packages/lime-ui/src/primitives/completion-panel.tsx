import { Text, View, tabularNums } from "../platform/adapter";
import { radius, spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";
import { Eyebrow } from "./internal.tsx";
import type { QuoteLine } from "./quote-panel.tsx";

/**
 * The terminal acknowledgement before a flow releases the screen. The surface stays neutral and
 * the amount is the largest thing on it, because that is the one fact worth remembering; the
 * accent appears once, as the mark that says this finished.
 */
export function CompletionPanel({
  headline,
  total,
  lines,
}: {
  headline: string;
  total: string;
  lines?: readonly QuoteLine[];
}) {
  const c = useLimeColors();
  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
      <View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View
            aria-hidden
            style={{
              width: 18,
              height: 18,
              borderRadius: radius.pill,
              backgroundColor: c.accent,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 6,
            }}
          >
            <Text style={{ fontSize: 11, lineHeight: 18, color: c.accentForeground }}>✓</Text>
          </View>
          <Eyebrow>{headline}</Eyebrow>
        </View>
        <Text style={{ ...typeStyle(typography.headlineXl), ...tabularNums, color: c.foreground }}>{total}</Text>
      </View>
      {lines?.length ? (
        <View style={{ gap: spacing.xs }}>
          {lines.map((line) => (
            <View key={line.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
              <Text numberOfLines={1} style={{ ...typeStyle(typography.metadata), color: c.mutedForeground, flexShrink: 1 }}>
                {line.label}
              </Text>
              <Text
                style={{ ...typeStyle(typography.metadata), ...tabularNums, color: c.mutedForeground, flexShrink: 0 }}
              >
                {line.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
