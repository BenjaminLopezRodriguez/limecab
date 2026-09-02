import type { ReactNode } from "react";
import { Text, View } from "../platform/adapter";
import { spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";
import { LiveMetric } from "../atoms/live-metric.tsx";
import { Eyebrow } from "./internal.tsx";

/**
 * The top of a surface reporting live state: a quiet label, the one sentence that matters, and
 * optional supporting detail. Monochrome — the hierarchy is entirely typographic, and the only
 * colour that can appear is the metric tile, which is live state rather than decoration.
 *
 * `chip` sits with the supporting line: a compact identifier — a PIN, a code, a plate.
 * `metric` and `trailing` share the top-right slot; `trailing` wins when both are given, since
 * a caller supplying a control there has already decided the number is not the headline.
 */
export function LiveSheetHeader({
  eyebrow,
  headline,
  supporting,
  chip,
  metric,
  metricLabel,
  trailing,
}: {
  eyebrow?: string;
  headline: string;
  supporting?: string;
  /** Compact identifier shown beside the supporting line. */
  chip?: ReactNode;
  /** One or two characters for the metric tile. Omit when there is no live number. */
  metric?: string;
  /** What the metric means, spoken. "4 minutes away", not "4". */
  metricLabel?: string;
  /** Replaces the metric — a search control, a chip, anything glanceable. */
  trailing?: ReactNode;
}) {
  const c = useLimeColors();
  const aside = trailing ?? (metric ? <LiveMetric value={metric} aria-label={metricLabel} /> : null);
  return (
    <View
      role="heading"
      style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingTop: spacing.sm }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text style={{ ...typeStyle(typography.headline), color: c.foreground }}>{headline}</Text>
        {supporting || chip ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 }}>
            {supporting ? (
              <Text style={{ ...typeStyle(typography.body), color: c.mutedForeground, flexShrink: 1, minWidth: 0 }}>
                {supporting}
              </Text>
            ) : null}
            {chip}
          </View>
        ) : null}
      </View>
      {aside ? <View style={{ flexShrink: 0 }}>{aside}</View> : null}
    </View>
  );
}
