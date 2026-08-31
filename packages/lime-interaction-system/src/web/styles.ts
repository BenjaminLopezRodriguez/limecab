import type { CSSProperties } from "react";
import { color, radius, spacing, typography } from "../tokens/index.ts";

export const t = (s: (typeof typography)[keyof typeof typography]): CSSProperties => ({
  fontSize: s.size,
  fontWeight: s.weight,
  letterSpacing: `${s.letterSpacing}em`,
});

export const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing.md,
  width: "100%",
  padding: `${spacing.md}px ${spacing.xl}px`,
  textAlign: "left",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  font: "inherit",
  position: "relative",
  overflow: "hidden",
};

export const sheetFrame = (width = 390): CSSProperties => ({
  width,
  background: color.panel.light,
  borderRadius: radius.sheet,
  border: `1px solid ${color.border.light}`,
  padding: `${spacing.lg}px ${spacing.xl}px`,
  fontFamily: "system-ui, -apple-system, sans-serif",
});

export const eyebrow: CSSProperties = {
  ...t(typography.eyebrow),
  textTransform: "uppercase",
  color: color.mutedForeground.light,
  marginBottom: 6,
};

export const headline: CSSProperties = t(typography.headline);

export const bodyMuted: CSSProperties = {
  ...t(typography.body),
  color: color.mutedForeground.light,
};
