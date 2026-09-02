import type { ReactNode } from "react";
import { Pressable, Text, View } from "../platform/adapter";
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
}: {
  children: ReactNode;
  label?: string;
  gutter?: number;
}) {
  return (
    // A run of radios is a radiogroup whether or not anyone named it. Downgrading an unlabelled
    // group to `list` strips the relationship the rows depend on to be announced as a choice.
    <View role="radiogroup" aria-label={label} style={{ marginHorizontal: -gutter }}>
      {children}
    </View>
  );
}

/**
 * Unselected rows are entirely monochrome. Selection is a neutral fill plus two small accent
 * marks — the rule at the leading edge and the glyph well — so a list of options never reads as
 * a list of green cards.
 */
export function ChoiceRow({
  glyph,
  title,
  detail,
  trailing,
  selected,
  disabled,
  disabledReason,
  onSelect,
  density = "default",
}: {
  glyph?: ReactNode;
  title: string;
  detail?: string;
  /** Right-aligned node — a price, a time, a chevron. */
  trailing?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Why the row can't be picked. Spoken with the row rather than shown on hover. */
  disabledReason?: string;
  onSelect?: () => void;
  /** Tighter 56pt rhythm with a 40pt glyph well for compact lists. */
  density?: "default" | "compact";
}) {
  const c = useLimeColors();
  const compact = density === "compact";
  return (
    <Pressable
      role="radio"
      aria-label={disabled && disabledReason ? `${title}. ${disabledReason}` : undefined}
      aria-checked={Boolean(selected)}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={onSelect}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        width: "100%",
        minHeight: compact ? 56 : undefined,
        paddingVertical: compact ? spacing.sm : spacing.md,
        paddingHorizontal: compact ? spacing.sm : spacing.xl,
        overflow: "hidden",
        backgroundColor: selected ? c.muted : "transparent",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {/* Selection reads as a rule at the leading edge, not a checkmark. */}
      {selected ? (
        <View
          aria-hidden
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 3, backgroundColor: c.accent }}
        />
      ) : null}
      {glyph ? <ChoiceGlyph selected={selected} size={compact ? 40 : 48}>{glyph}</ChoiceGlyph> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>
          {title}
        </Text>
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
            <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>{trailing}</Text>
          ) : (
            trailing
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

/** The rounded well carrying a row's leading glyph. Takes the accent when its row is chosen. */
export function ChoiceGlyph({ children, selected, size = 48 }: { children?: ReactNode; selected?: boolean; size?: number }) {
  const c = useLimeColors();
  return (
    <View
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.card,
        ...continuousCorners,
        backgroundColor: selected ? c.accent : c.muted,
      }}
    >
      {typeof children === "string" || typeof children === "number" ? (
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
