/**
 * Derived from: src/components/ui/{button,input,progress,separator,dialog,drawer,icon}.tsx
 * Layer: web renderer
 * Preserved: Lime pill geometry, dominant CTA sizing, progress bar treatment.
 * Removed: @base-ui, cva, Tailwind, hugeicons.
 */
import type { CSSProperties, InputHTMLAttributes, ReactNode } from "react";
import { color, radius, spacing, surface, typography } from "../tokens/index.ts";
import { t } from "./styles.ts";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "xs" | "icon";

export function Button({
  children, variant = "default", size = "default", loading, disabled, onClick, style, "aria-label": ariaLabel,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  "aria-label"?: string;
}) {
  const heights: Record<ButtonSize, number> = { default: surface.cta.default, sm: 40, lg: surface.cta.lg, xs: 32, icon: 40 };
  const bg: Record<ButtonVariant, string> = {
    default: color.foreground.light,
    secondary: color.muted.light,
    outline: "transparent",
    ghost: "transparent",
    destructive: color.destructive.light,
    link: "transparent",
  };
  const fg: Record<ButtonVariant, string> = {
    default: color.canvas.light,
    secondary: color.foreground.light,
    outline: color.foreground.light,
    ghost: color.foreground.light,
    destructive: color.canvas.light,
    link: color.foreground.light,
  };
  const h = heights[size];
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading || undefined}
      aria-label={ariaLabel}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: spacing.sm,
        height: size === "icon" ? h : h, width: size === "icon" ? h : undefined,
        minWidth: size === "icon" ? h : undefined,
        padding: size === "icon" ? 0 : `0 ${spacing.xl}px`,
        borderRadius: radius.pill,
        border: variant === "outline" ? `1px solid ${color.border.light}` : "none",
        background: bg[variant],
        color: fg[variant],
        ...t(typography.cta),
        textDecoration: variant === "link" ? "underline" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}>
      {loading ? "…" : children}
    </button>
  );
}

export function LimeInput({
  value, placeholder, error, disabled, search, onChange, "aria-label": ariaLabel,
}: {
  value?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  search?: boolean;
  onChange?: (v: string) => void;
  "aria-label"?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ position: "relative" }}>
        {search ? (
          <span aria-hidden style={{ position: "absolute", left: spacing.lg, top: "50%", transform: "translateY(-50%)",
            color: color.mutedForeground.light }}>⌕</span>
        ) : null}
        <input
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange?.(e.target.value)}
          style={{
            width: "100%", height: surface.cta.default, boxSizing: "border-box",
            padding: search ? `0 ${spacing.xl}px 0 ${spacing.xl + 20}px` : `0 ${spacing.xl}px`,
            borderRadius: radius.pill,
            border: `1px solid ${error ? color.destructive.light : color.border.light}`,
            background: color.panel.light, font: "inherit", ...t(typography.body),
            outline: "none",
          }}
        />
      </div>
      {error ? (
        <span role="alert" style={{ ...t(typography.metadata), color: color.destructive.light }}>{error}</span>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, label = "Progress" }: { value: number; label?: string }) {
  return (
    <div role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}
      style={{ height: 6, borderRadius: radius.pill, background: color.muted.light, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, value))}%`,
        background: color.lime.light, borderRadius: radius.pill,
        transition: "width 220ms ease" }} />
    </div>
  );
}

export function Separator({ orientation = "horizontal" }: { orientation?: "horizontal" | "vertical" }) {
  return orientation === "horizontal" ? (
    <hr style={{ border: "none", borderTop: `1px solid ${color.border.light}`, margin: `${spacing.md}px 0` }} />
  ) : (
    <div style={{ width: 1, alignSelf: "stretch", background: color.border.light }} />
  );
}

export function DialogFrame({ title, description, children, onClose }: {
  title: string; description?: string; children: ReactNode; onClose?: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" aria-describedby={description ? "dlg-desc" : undefined}
      style={{ width: 360, maxWidth: "90vw", background: color.panel.light, borderRadius: radius.sheet,
        border: `1px solid ${color.border.light}`, padding: spacing.xl, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: spacing.md }}>
        <div>
          <div id="dlg-title" style={t(typography.headline)}>{title}</div>
          {description ? <div id="dlg-desc" style={{ ...t(typography.body), marginTop: 4,
            color: color.mutedForeground.light }}>{description}</div> : null}
        </div>
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ border: "none", background: "transparent", fontSize: 20, cursor: "pointer" }}>×</button>
        ) : null}
      </div>
      <div style={{ marginTop: spacing.lg }}>{children}</div>
    </div>
  );
}

export function DrawerFrame({ title, children, snapLabel }: {
  title?: string; children: ReactNode; snapLabel?: string;
}) {
  return (
    <div style={{ width: 390, background: color.panel.light, borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
      border: `1px solid ${color.border.light}`, borderBottom: "none", padding: spacing.xl,
      fontFamily: "system-ui" }}>
      <div aria-hidden style={{ width: 36, height: 4, borderRadius: radius.pill,
        background: color.border.light, margin: "0 auto", marginBottom: spacing.md }} />
      {title ? <div style={{ ...t(typography.subhead), marginBottom: spacing.md }}>{title}</div> : null}
      {snapLabel ? <div style={{ ...t(typography.metadata), color: color.mutedForeground.light,
        marginBottom: spacing.sm }}>{snapLabel}</div> : null}
      {children}
    </div>
  );
}

export function IconGlyph({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <span aria-hidden style={{ display: "inline-grid", placeItems: "center", width: size, height: size,
      fontSize: size * 0.85 }}>{children}</span>
  );
}

/** Map-floating circular control. */
export function MapFloatingButton({ label, children, onPress }: {
  label: string; children: ReactNode; onPress?: () => void;
}) {
  return (
    <button type="button" aria-label={label} onClick={onPress}
      style={{ width: 44, height: 44, borderRadius: radius.pill, border: `1px solid ${color.border.light}`,
        background: color.panel.light, display: "grid", placeItems: "center", cursor: "pointer",
        boxShadow: `0 2px 8px rgba(0,0,0,0.12)` }}>
      {children}
    </button>
  );
}
