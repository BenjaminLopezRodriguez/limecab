import type { ReactNode } from "react";
import { Text, View } from "../platform/adapter";

/**
 * A square well that centres one glyph. Text children are rendered for you; anything else — an
 * SVG from the consumer's own icon set — is placed as-is, which is why this kit ships no icon
 * dependency of its own.
 */
export function IconGlyph({ children, size = 20, color }: { children?: ReactNode; size?: number; color?: string }) {
  const text = typeof children === "string" || typeof children === "number";
  return (
    <View aria-hidden style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {text ? <Text style={{ fontSize: size * 0.85, lineHeight: size, color }}>{children}</Text> : children}
    </View>
  );
}
