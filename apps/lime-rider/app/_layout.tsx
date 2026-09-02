import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LimeThemeProvider } from "@lime/ui";
import { useThemeChoice, ThemeChoiceProvider } from "../src/theme-choice";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeChoiceProvider>
          <Themed />
        </ThemeChoiceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Themed() {
  const { scheme } = useThemeChoice();
  return (
    <LimeThemeProvider scheme={scheme}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </LimeThemeProvider>
  );
}
