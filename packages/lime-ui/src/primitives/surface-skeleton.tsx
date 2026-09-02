import { useEffect, useState } from "react";
import { View } from "../platform/adapter";
import { radius, spacing } from "../tokens/index.ts";
import { continuousCorners } from "../style/corners.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * Holds the shape of what is coming, so arrival is not a layout jump. Widths taper the way real
 * copy does: a heading, body, then a short last line. Entirely neutral — nothing has happened
 * yet, so there is nothing to signal.
 *
 * ponytail: the pulse is a two-state interval rather than a driven animation — it needs no
 * Animated on native and no keyframes on web, at the cost of a JS-thread re-render every 700ms.
 * Move it to Reanimated if it ever has to match a real transition curve.
 */
export function SurfaceSkeleton({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  const c = useLimeColors();
  const [dim, setDim] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setDim((d) => !d), 700);
    return () => clearInterval(id);
  }, []);

  return (
    <View role="status" aria-label={label} aria-busy style={{ gap: spacing.md, paddingTop: spacing.md }}>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            height: i === 0 ? 24 : 16,
            width: i === 0 ? "60%" : i === rows - 1 ? "40%" : "85%",
            borderRadius: radius.mapLabel,
            ...continuousCorners,
            backgroundColor: c.muted,
            opacity: dim ? 0.45 : 1,
          }}
        />
      ))}
    </View>
  );
}
