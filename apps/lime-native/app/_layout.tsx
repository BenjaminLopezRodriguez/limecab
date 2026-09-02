import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LimeThemeProvider } from "@lime/ui";
import { useThemeChoice, ThemeChoiceProvider } from "../src/theme-choice";

/**
 * Application runtime only. Routing, providers, entrypoint — nothing about how a scene renders.
 *
 * Routes establish the two major application contexts (rider, driver) and nothing else. The
 * workflow inside each one belongs to the interaction system, not to the navigator.
 */
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
    // No `scheme` prop means follow the OS, which is the default the app ships with.
    <LimeThemeProvider scheme={scheme}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </LimeThemeProvider>
  );
}
