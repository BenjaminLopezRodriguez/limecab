/**
 * Native adapter — the primary target. Thin wrappers over react-native so the shared
 * components stay free of any renderer import.
 */
import {
  useColorScheme as useRNColorScheme,
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  TextInput as RNTextInput,
  StyleSheet,
  type StyleProp as RNStyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import type {
  PlatformAdapter,
  PressableProps,
  Style,
  StyleProp,
  TextInputProps,
  TextProps,
  ViewProps,
} from "./types.ts";

const s = (style: StyleProp) => StyleSheet.flatten(style as RNStyleProp<ViewStyle & TextStyle>);

export function View({ style, children, ...rest }: ViewProps) {
  return (
    <RNView {...rest} style={s(style)}>
      {children}
    </RNView>
  );
}

export function Text({ style, children, numberOfLines, ...rest }: TextProps) {
  return (
    <RNText {...rest} numberOfLines={numberOfLines} style={s(style)}>
      {children}
    </RNText>
  );
}

export function Pressable({ style, children, onPress, disabled, ...rest }: PressableProps) {
  return (
    <RNPressable
      {...rest}
      onPress={onPress}
      disabled={disabled}
      // Touch feedback is the native affordance; hover is never the only path to an action.
      style={({ pressed }) => [s(style), pressed && !disabled ? { opacity: 0.75 } : null]}
    >
      {children}
    </RNPressable>
  );
}

export function TextInput({ style, editable, ...rest }: TextInputProps) {
  return <RNTextInput {...rest} editable={editable} style={s(style)} />;
}

/** RN reports `null` before the OS preference is known; light is the safer first paint. */
export const useColorScheme = (): "light" | "dark" => (useRNColorScheme() === "dark" ? "dark" : "light");

export const tabularNums: Style = { fontVariant: ["tabular-nums"] };

const adapter: PlatformAdapter = { View, Text, Pressable, TextInput, useColorScheme, tabularNums };
export default adapter;
