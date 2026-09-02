import { View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Button,
  ChoiceGlyph,
  ChoiceList,
  ChoiceRow,
  LiveSheetHeader,
  spacing,
  useLimeColors,
} from "@lime/ui";
import { useThemeChoice } from "../src/theme-choice";

/**
 * The only genuine navigation boundary in the app: which product am I using. Everything past
 * this point is interaction state, not routes.
 */
export default function Chooser() {
  const c = useLimeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useThemeChoice();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        paddingTop: insets.top + spacing.xxl,
        paddingBottom: insets.bottom + spacing.lg,
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
      }}
    >
      <LiveSheetHeader eyebrow="Lime" headline="Proving ground" supporting="Native renderer · deterministic scenarios" />

      <ChoiceList gutter={spacing.xl}>
        <ChoiceRow
          glyph={<ChoiceGlyph>◆</ChoiceGlyph>}
          title="Rider"
          detail="Home → quote → matching → in ride → complete"
          onSelect={() => router.push("/rider")}
        />
        <ChoiceRow
          glyph={<ChoiceGlyph>◈</ChoiceGlyph>}
          title="Driver"
          detail="Offline → offer → pickup → trip → earnings"
          onSelect={() => router.push("/driver")}
        />
      </ChoiceList>

      <View style={{ flex: 1 }} />
      <Button variant="outline" label="Parity gallery" onPress={() => router.push("/parity")} />
      <Button variant="outline" label={`Theme: ${theme.label}`} onPress={theme.cycle} />
    </View>
  );
}
