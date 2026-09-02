import { Text, tabularNums } from "../platform/adapter";
import { radius, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { continuousCorners } from "../style/corners.ts";
import { useLimeColors } from "../theme/index.tsx";

/** The tile is a glance, not a readout: two characters is the whole budget. */
const MAX_CHARS = 2;
const SIZE = 48;

/**
 * One number, sized to be read at arm's length. Accent-filled because a live metric is live
 * state — the count that is still moving — and that is one of the few things the brand colour
 * is allowed to mark.
 *
 * Deliberately not a countdown: it holds whatever value the caller computed. Units, ordinals
 * and sentences do not fit and do not belong; they go in `aria-label`, which is also what a
 * screen reader gets instead of two bare digits.
 */
export function LiveMetric({ value, "aria-label": ariaLabel }: { value: string; "aria-label"?: string }) {
  const c = useLimeColors();
  const shown = value.slice(0, MAX_CHARS);
  return (
    <Text
      aria-label={ariaLabel ?? shown}
      style={{
        ...typeStyle(typography.headline),
        ...tabularNums,
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        lineHeight: SIZE,
        textAlign: "center",
        borderRadius: radius.chip,
        ...continuousCorners,
        backgroundColor: c.accent,
        color: c.accentForeground,
      }}
    >
      {shown}
    </Text>
  );
}
