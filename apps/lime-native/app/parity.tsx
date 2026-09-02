import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { ChoiceList, ChoiceRow, ChoiceSection, LiveSheetHeader, spacing, useLimeColors } from "@lime/ui";
import { driverHappyPath, riderHappyPath } from "@lime/interaction-system/scenarios";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Parity gallery — jump straight to any canonical state.
 *
 * Every state is reachable in one tap instead of replaying the flow to reach it, which is the
 * difference between comparing a state against production in seconds and in minutes. It renders
 * the real routes with the real renderer, so what you see is what ships; only the entry point
 * is shortcut.
 *
 * Development scaffolding. Not part of either product.
 */
export default function Parity() {
  const c = useLimeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const open = (product: "rider" | "driver", step: string) =>
    router.push({ pathname: `/${product}`, params: { step } });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xxl,
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <LiveSheetHeader eyebrow="Dev" headline="Parity gallery" supporting="Jump to a canonical state" />

      <ChoiceSection title="Rider">
        <ChoiceList label="Rider states" gutter={0}>
          {riderHappyPath.order.map((step) => (
            <ChoiceRow key={step} title={step} onSelect={() => open("rider", step)} trailing="›" />
          ))}
        </ChoiceList>
      </ChoiceSection>

      <ChoiceSection title="Driver">
        <ChoiceList label="Driver states" gutter={0}>
          {driverHappyPath.order.map((step) => (
            <ChoiceRow key={step} title={step} onSelect={() => open("driver", step)} trailing="›" />
          ))}
        </ChoiceList>
      </ChoiceSection>

      <View style={{ height: spacing.xl }} />
    </ScrollView>
  );
}
