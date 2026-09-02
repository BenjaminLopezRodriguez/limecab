import { View } from "../platform/adapter";
import { radius } from "../tokens/index.ts";
import { useLimeColors } from "../theme/index.tsx";

/** Determinate only. Progress is live state, so the filled portion carries the accent. */
export function ProgressBar({ value, label = "Progress" }: { value: number; label?: string }) {
  const c = useLimeColors();
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height: 6, borderRadius: radius.pill, backgroundColor: c.muted, overflow: "hidden" }}
    >
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: c.accent, borderRadius: radius.pill }} />
    </View>
  );
}
