import { View } from "../platform/adapter";
import { spacing } from "../tokens/index.ts";
import { useLimeColors } from "../theme/index.tsx";

/** A hairline. Borders are the primary separation cue; shadows are for things over a canvas. */
export function Separator({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  const c = useLimeColors();
  return orientation === "horizontal" ? (
    <View aria-hidden style={{ height: 1, backgroundColor: c.border, marginVertical: spacing.md }} />
  ) : (
    <View aria-hidden style={{ width: 1, alignSelf: "stretch", backgroundColor: c.border }} />
  );
}
