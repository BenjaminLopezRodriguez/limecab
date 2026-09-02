import type { ReactNode } from "react";
// React Native's own StatusBar, not expo-status-bar: the renderer stays free of Expo deps
// so a bare React Native host can consume it too.
import { StatusBar, StyleSheet, View } from "react-native";
import { useLimeColors, useLimeTheme } from "@lime/ui";
import type { ShellIntent } from "../core/shell.ts";

/**
 * Host chrome, read from `ShellIntent` — which sits beside the scene, never inside it.
 * "this scene wants navigation hidden" is not "this scene renders navigation".
 *
 * The shell owns the status bar and the chrome slots. It does not know what product is running;
 * driver simply asks for `driver` chrome and gets no furniture, exactly as production does.
 */
export interface NativeShellProps {
  intent?: ShellIntent;
  top?: ReactNode;
  bottom?: ReactNode;
  children?: ReactNode;
}

export function NativeShell({ intent, top, bottom, children }: NativeShellProps) {
  const c = useLimeColors();
  const { scheme } = useLimeTheme();

  const hidden = intent?.navigationVisibility === "hidden";
  const showTop = intent?.topChrome !== undefined && intent.topChrome !== "none" && intent.topChrome !== "driver";
  const showBottom = !hidden && intent?.bottomChrome !== "none" && intent?.bottomChrome !== "driver";

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar barStyle={scheme === "dark" ? "light-content" : "dark-content"} />
      {children}
      {showTop && top ? <View style={[styles.top, POINTER_BOX_NONE]}>{top}</View> : null}
      {showBottom && bottom ? <View style={[styles.bottom, POINTER_BOX_NONE]}>{bottom}</View> : null}
    </View>
  );
}

// `pointerEvents` as a prop is deprecated in React Native 0.86; it is a style now.
const POINTER_BOX_NONE = { pointerEvents: "box-none" } as const;

const styles = StyleSheet.create({
  root: { flex: 1, overflow: "hidden" },
  top: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 40 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 40 },
});
