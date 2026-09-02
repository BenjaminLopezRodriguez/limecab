import { View } from "react-native";
import { Button, spacing, useLimeColors } from "@lime/ui";
import { useThemeChoice } from "./theme-choice";

/**
 * Development controls. The proving ground has no backend to move state for it, so the theme
 * cycle and a step nudge live here — clearly marked as scaffolding rather than product chrome.
 */
export function DevBar({
  top,
  onBack,
  onNext,
  backLabel = "Back",
}: {
  top: number;
  onBack?: () => void;
  /** Advances the scenario where production would be advanced by a real event. */
  onNext?: () => void;
  backLabel?: string;
}) {
  const c = useLimeColors();
  const theme = useThemeChoice();
  return (
    <View
      style={{
        pointerEvents: "box-none",
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        paddingTop: top + spacing.sm,
        paddingHorizontal: spacing.lg,
        flexDirection: "row",
        justifyContent: "space-between",
        gap: spacing.sm,
      }}
    >
      <Button size="sm" variant="secondary" label={backLabel} onPress={onBack} style={{ backgroundColor: c.surface }} />
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {onNext ? (
          <Button size="sm" variant="secondary" label="Next ▸" onPress={onNext} style={{ backgroundColor: c.surface }} />
        ) : null}
        <Button size="sm" variant="secondary" label={theme.label} onPress={theme.cycle} style={{ backgroundColor: c.surface }} />
      </View>
    </View>
  );
}
