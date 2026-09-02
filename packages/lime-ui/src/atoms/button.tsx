import type { ReactNode } from "react";
import { Pressable, Text } from "../platform/adapter";
import type { Style } from "../platform/types.ts";
import type { ColorRoles } from "../tokens/color.ts";
import { radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * `default` is the neutral dominant control — near-black on light, near-white on dark. `accent`
 * spends the brand colour, and is reserved for the one action a surface exists to get done.
 */
export type ButtonVariant = "default" | "accent" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "xs" | "icon";

const height: Record<ButtonSize, number> = {
  default: surface.cta.default,
  sm: surface.cta.sm,
  lg: surface.cta.lg,
  xs: 32,
  icon: surface.cta.sm,
};

function palette(c: ColorRoles, variant: ButtonVariant): { background: string; foreground: string } {
  switch (variant) {
    case "accent":
      return { background: c.accent, foreground: c.accentForeground };
    case "secondary":
      return { background: c.muted, foreground: c.foreground };
    case "destructive":
      return { background: c.destructive, foreground: c.destructiveForeground };
    case "outline":
    case "ghost":
    case "link":
      return { background: "transparent", foreground: c.foreground };
    default:
      return { background: c.foreground, foreground: c.background };
  }
}

export interface ButtonProps {
  children?: ReactNode;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  "aria-label"?: string;
  style?: Style;
}

/**
 * The pill is the button geometry at every size — squared corners belong to the map, not to
 * controls.
 *
 * Text can arrive as `label` or as children; either way it is wrapped for you, because a bare
 * string is a crash on React Native. Non-text children (a glyph, a row) are placed as-is.
 */
export function Button({
  children,
  label,
  variant = "default",
  size = "default",
  loading,
  disabled,
  onPress,
  "aria-label": ariaLabel,
  style,
}: ButtonProps) {
  const c = useLimeColors();
  const { background, foreground } = palette(c, variant);
  const h = height[size];
  const icon = size === "icon";
  const inactive = disabled || loading;
  const text = label ?? (typeof children === "string" || typeof children === "number" ? children : undefined);

  return (
    <Pressable
      role="button"
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      aria-disabled={inactive || undefined}
      disabled={inactive}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        height: h,
        width: icon ? h : undefined,
        paddingHorizontal: icon ? 0 : spacing.xl,
        borderRadius: radius.pill,
        borderWidth: variant === "outline" ? 1 : 0,
        borderColor: c.border,
        backgroundColor: background,
        opacity: inactive ? 0.4 : 1,
        ...style,
      }}
    >
      {text === undefined && !loading ? (
        children
      ) : (
        <Text
          numberOfLines={1}
          style={{
            ...typeStyle(typography.cta),
            color: foreground,
            textDecorationLine: variant === "link" ? "underline" : "none",
          }}
        >
          {loading ? "…" : text}
        </Text>
      )}
    </Pressable>
  );
}
