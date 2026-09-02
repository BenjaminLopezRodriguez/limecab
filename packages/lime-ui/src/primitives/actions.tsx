import { Text, View } from "../platform/adapter";
import { spacing, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";
import { Button } from "../atoms/button.tsx";

/**
 * The dominant action on a surface — the thing the surface exists to get done. This is where
 * the brand accent earns its place: one accented control per surface, and the eye finds it
 * before reading anything.
 *
 * One per surface. If a second action wants this weight, the surface is asking two questions
 * and should be split.
 */
export function PrimaryAction({
  label,
  loading,
  disabled,
  destructive,
  onPress,
}: {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Button
      label={label}
      variant={destructive ? "destructive" : "accent"}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      style={{ width: "100%" }}
    />
  );
}

/** The way out. Neutral outline — always reachable, never competing for attention. */
export function SecondaryAction({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return <Button label={label} variant="outline" disabled={disabled} onPress={onPress} style={{ width: "100%" }} />;
}

/**
 * A consequential transition asked as a question. Confirm is dominant; cancel stays a real,
 * full-width target rather than a dismissible corner.
 */
export function ConfirmActionSurface({
  headline,
  body,
  confirmLabel,
  cancelLabel = "Never mind",
  destructive,
  loading,
  onConfirm,
  onCancel,
}: {
  headline: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const c = useLimeColors();
  return (
    <View style={{ gap: spacing.lg }}>
      <View>
        <Text style={{ ...typeStyle(typography.headline), color: c.foreground }}>{headline}</Text>
        {body ? (
          <Text style={{ ...typeStyle(typography.body), marginTop: 4, color: c.mutedForeground }}>{body}</Text>
        ) : null}
      </View>
      <View style={{ gap: spacing.sm }}>
        <PrimaryAction label={confirmLabel} destructive={destructive} loading={loading} onPress={onConfirm} />
        <SecondaryAction label={cancelLabel} onPress={onCancel} />
      </View>
    </View>
  );
}
