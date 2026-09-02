import type { ReactNode } from "react";
import { Pressable, tabularNums, Text, View } from "../platform/adapter";
import { radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { continuousCorners } from "../style/corners.ts";
import { useLimeColors } from "../theme/index.tsx";
import { Eyebrow } from "./internal.tsx";

/**
 * A run of mutually exclusive options. Full-bleed to the surface gutter — no ring around the
 * group and no dividers between rows; the rows sit close enough to read as one list.
 *
 * `gutter` is how far the list bleeds past its container's padding. Pass your own if your
 * surface uses a different inset.
 */
export function ChoiceList({
  children,
  label,
  gutter = spacing.xl,
  role = "radiogroup",
}: {
  children: ReactNode;
  label?: string;
  gutter?: number;
  /** Use `list` when pressing a row commits an action rather than choosing a radio value. */
  role?: "radiogroup" | "list";
}) {
  return (
    // A run of radios is a radiogroup whether or not anyone named it. Downgrading an unlabelled
    // group to `list` strips the relationship the rows depend on to be announced as a choice.
    <View role={role} aria-label={label} style={{ marginHorizontal: -gutter }}>
      {children}
    </View>
  );
}

/**
 * Unselected rows are entirely monochrome. Selection is a pale accent fill plus a dark leading
 * rule and solid accent glyph well, matching the portable selected-row grammar.
 */
export function ChoiceRow({
  glyph,
  title,
  titleAffix,
  badge,
  detail,
  trailing,
  selected,
  disabled,
  disabledReason,
  onSelect,
  density = "default",
  role = "radio",
  "aria-label": ariaLabel,
}: {
  glyph?: ReactNode;
  title: string;
  /** Compact metadata kept on the title line, such as a seat count. */
  titleAffix?: ReactNode;
  /** Optional status pill kept after the title metadata. */
  badge?: ReactNode;
  detail?: string;
  /** Right-aligned node — a price, a time, a chevron. */
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Why the row can't be picked. Spoken with the row rather than shown on hover. */
  disabledReason?: string;
  onSelect?: () => void;
  /** Compact rows use a 40pt well; small-ring rows use a 28pt location target. */
  density?: "default" | "compact" | "small-ring";
  /** Buttons fit commit-ish rows; radios remain the portable selection default. */
  role?: "radio" | "button";
  "aria-label"?: string;
}) {
  const c = useLimeColors();
  const compact = density === "compact";
  const smallRing = density === "small-ring";
  return (
    <Pressable
      role={role}
      aria-label={disabled && disabledReason ? `${ariaLabel ?? title}. ${disabledReason}` : ariaLabel}
      aria-checked={role === "radio" ? Boolean(selected) : undefined}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        width: "100%",
        minHeight: compact ? 56 : smallRing ? 64 : undefined,
        paddingVertical: compact ? spacing.sm : smallRing ? spacing.sm : spacing.md,
        paddingHorizontal: compact ? spacing.sm : spacing.xl,
        overflow: "hidden",
        backgroundColor: "transparent",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* A translucent layer keeps the accent pale without assuming the theme uses hex. */}
      {selected ? (
        <View
          aria-hidden
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.accent, opacity: 0.22 }}
        />
      ) : null}
      {/* Selection reads as a dark rule at the leading edge, not a checkmark. */}
      {selected ? (
        <View
          aria-hidden
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 4, backgroundColor: c.accentForeground }}
        />
      ) : null}
      {glyph || smallRing ? (
        <ChoiceGlyph selected={selected} size={compact ? 40 : smallRing ? 28 : 48} variant={smallRing ? "ring" : "filled"}>
          {glyph}
        </ChoiceGlyph>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{ ...typeStyle(typography.bodyStrong), flexShrink: 1, color: c.foreground }}
          >
            {title}
          </Text>
          {titleAffix ? (
            <View style={{ flexShrink: 0 }}>
              {typeof titleAffix === "string" || typeof titleAffix === "number" ? (
                <Text style={{ ...typeStyle(typography.metadata), color: c.mutedForeground }}>{titleAffix}</Text>
              ) : titleAffix}
            </View>
          ) : null}
          {badge ? (
            <View
              style={{
                flexShrink: 0,
                minHeight: 20,
                justifyContent: "center",
                paddingHorizontal: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: c.accent,
              }}
            >
              {typeof badge === "string" || typeof badge === "number" ? (
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.accentForeground }}>{badge}</Text>
              ) : badge}
            </View>
          ) : null}
        </View>
        {detail ? (
          <Text
            numberOfLines={1}
            style={{ ...typeStyle(typography.metadata), marginTop: 2, color: c.mutedForeground }}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <View style={{ flexShrink: 0 }}>
          {typeof trailing === "string" || typeof trailing === "number" ? (
            <Text style={{ ...typeStyle(typography.bodyStrong), ...tabularNums, color: c.foreground }}>{trailing}</Text>
          ) : (
            trailing
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The circular well carrying a row's leading glyph. Takes the accent when its row is chosen. */
export function ChoiceGlyph({
  children,
  selected,
  size = 48,
  variant = "filled",
}: {
  children?: ReactNode;
  selected?: boolean;
  size?: number;
  variant?: "filled" | "ring";
}) {
  const c = useLimeColors();
  const ring = variant === "ring";
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        ...(ring ? {} : continuousCorners),
        backgroundColor: selected ? c.accent : c.muted,
      }}
    >
      {ring ? (
        <View
          style={{
            width: 14,
            height: 14,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: radius.pill,
            borderWidth: 2,
            borderColor: selected ? c.surface : c.mutedForeground,
          }}
        >
          <View
            style={{
              width: 4,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: selected ? c.surface : c.mutedForeground,
            }}
          />
        </View>
      ) : typeof children === "string" || typeof children === "number" ? (
        <Text style={{ fontSize: 20, color: selected ? c.accentForeground : c.foreground }}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

/**
 * A titled group of choices. The title is the only thing that distinguishes one group from the
 * next — no card, no divider — so several sections stack into one continuous list instead of a
 * page of boxes.
 *
 * `rows` is the scannable presentation, where a second line is as load-bearing as the first;
 * `chips` is the one-tap rail for a handful of shortcuts. Both take `ChoiceRow` / `ChoiceChip`
 * children, so a section carries no opinion about what is being chosen.
 */
export function ChoiceSection({
  title,
  variant = "rows",
  gutter = spacing.xl,
  children,
}: {
  title?: string;
  variant?: "rows" | "chips";
  /** How far a `rows` section bleeds past its container's padding. */
  gutter?: number;
  children: ReactNode;
}) {
  return (
    <View aria-label={title} style={{ gap: spacing.xs }}>
      {title ? <Eyebrow>{title}</Eyebrow> : null}
      {variant === "chips" ? (
        <View role="list" style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
          {children}
        </View>
      ) : (
        <ChoiceList gutter={gutter}>{children}</ChoiceList>
      )}
    </View>
  );
}

/**
 * The compact form of a choice: a bordered capsule sized to its label. Selection fills it with
 * the neutral dominant colour rather than the accent — a rail of shortcuts is navigation, and
 * green on every chip would say nothing.
 */
export function ChoiceChip({
  label,
  glyph,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  glyph?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const c = useLimeColors();
  return (
    <Pressable
      // A chip that reports a checked state is a radio, not a button — `aria-checked` is not
      // valid on a button role, so the state simply goes unannounced.
      role={onSelect ? "radio" : "button"}
      aria-label={label}
      aria-checked={onSelect ? selected : undefined}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        maxWidth: "100%",
        height: surface.cta.default,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? "transparent" : c.border,
        backgroundColor: selected ? c.foreground : c.surface,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {glyph ? (
        <View aria-hidden style={{ flexShrink: 0 }}>
          {typeof glyph === "string" || typeof glyph === "number" ? (
            <Text style={{ fontSize: 15, color: selected ? c.background : c.mutedForeground }}>{glyph}</Text>
          ) : (
            glyph
          )}
        </View>
      ) : null}
      <Text
        numberOfLines={1}
        style={{ ...typeStyle(typography.metadata), flexShrink: 1, color: selected ? c.background : c.foreground }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
