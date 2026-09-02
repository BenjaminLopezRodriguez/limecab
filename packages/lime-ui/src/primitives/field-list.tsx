import type { ReactNode } from "react";
import { Text, View } from "../platform/adapter";
import { spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

/**
 * A short form inside a surface. Fields separated by space alone — no rules, no card per row —
 * because a boxed row per question makes five questions look like fifteen.
 *
 * Keep it short. A field list long enough to scroll is a disclosure failure rather than a
 * rendering one: the extra questions belong to a surface of their own.
 */
export function FieldList({ children }: { children: ReactNode }) {
  return <View style={{ gap: spacing.lg }}>{children}</View>;
}

/**
 * One question. `control` sits beside the label — for anything small and fixed-width, a
 * `Switch` or a stepper — and `children` sit beneath it, for anything that wants the full
 * width: an `Input`, a run of `ChoiceChip`s.
 *
 * The primitive holds no value and knows no field kinds; the caller owns the state and passes
 * the control it wants, which is what keeps a form generic.
 */
export function Field({
  label,
  description,
  control,
  children,
}: {
  label: string;
  /** One line under the label. What the answer affects, not how to answer it. */
  description?: string;
  /** Trailing control, vertically aligned to the label. */
  control?: ReactNode;
  /** Full-width control beneath the label. */
  children?: ReactNode;
}) {
  const c = useLimeColors();
  return (
    <View style={{ gap: children ? spacing.sm : 0 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.lg }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground }}>{label}</Text>
          {description ? (
            <Text style={{ ...typeStyle(typography.body), marginTop: 2, color: c.mutedForeground }}>{description}</Text>
          ) : null}
        </View>
        {control ? <View style={{ flexShrink: 0 }}>{control}</View> : null}
      </View>
      {children}
    </View>
  );
}
