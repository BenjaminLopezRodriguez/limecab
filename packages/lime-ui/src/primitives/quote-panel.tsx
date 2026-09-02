import { Text, View, tabularNums } from "../platform/adapter";
import { spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

export interface QuoteLine {
  label: string;
  value: string;
}

/**
 * What it will cost, itemised, with the total ruled off. Entirely monochrome: the total stands
 * out because it is larger and heavier than the lines above it, not because it is coloured.
 *
 * Values are pre-formatted strings — currency and locale are the consumer's decision.
 */
export function QuotePanel({
  lines,
  total,
  totalLabel = "Total",
  note,
}: {
  lines: readonly QuoteLine[];
  total: string;
  totalLabel?: string;
  note?: string;
}) {
  const c = useLimeColors();
  return (
    <View style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
      {lines.map((line) => (
        <View key={line.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
          <Text numberOfLines={1} style={{ ...typeStyle(typography.body), color: c.mutedForeground, flexShrink: 1 }}>
            {line.label}
          </Text>
          <Text style={{ ...typeStyle(typography.body), ...tabularNums, color: c.foreground, flexShrink: 0 }}>
            {line.value}
          </Text>
        </View>
      ))}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: spacing.xs,
          paddingTop: spacing.md,
          borderTopWidth: 1,
          borderColor: c.border,
        }}
      >
        <Text style={{ ...typeStyle(typography.bodyStrong), color: c.mutedForeground }}>{totalLabel}</Text>
        <Text style={{ ...typeStyle(typography.headline), ...tabularNums, color: c.foreground }}>{total}</Text>
      </View>
      {note ? (
        <Text style={{ ...typeStyle(typography.metadata), color: c.mutedForeground }}>{note}</Text>
      ) : null}
    </View>
  );
}
