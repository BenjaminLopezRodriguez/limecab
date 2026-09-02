import type { ReactNode } from "react";
import { Text } from "../platform/adapter";
import { typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

/** Small-caps label above a headline. Used by several primitives; not part of the public API. */
export function Eyebrow({ children }: { children: ReactNode }) {
  const c = useLimeColors();
  return (
    <Text
      style={{
        ...typeStyle(typography.eyebrow),
        textTransform: "uppercase",
        color: c.mutedForeground,
        marginBottom: 6,
      }}
    >
      {children}
    </Text>
  );
}
