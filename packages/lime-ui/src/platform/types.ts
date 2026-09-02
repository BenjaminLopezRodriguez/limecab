/**
 * The whole platform contract. Atoms and primitives may import nothing else that touches a
 * renderer — no `react-native`, no DOM, no `react-dom`.
 *
 * Prop names are ARIA-flavoured because modern React Native (>= 0.71) accepts `role` and
 * `aria-*` directly and maps them onto its accessibility layer, so one spelling serves both
 * adapters instead of a translation table.
 */
import type { ReactNode } from "react";

/** A plain style object. RN-safe keys only: no classNames, no selectors, no `display: grid`. */
export type Style = {
  [key: string]: string | number | boolean | undefined | readonly string[] | Style | readonly Style[];
};

export type StyleProp = Style | undefined | false | readonly (Style | undefined | false)[];

export type Role =
  | "none"
  | "button"
  | "link"
  | "heading"
  | "list"
  | "listitem"
  | "radio"
  | "radiogroup"
  | "checkbox"
  | "switch"
  | "progressbar"
  | "alert"
  | "status"
  | "img";

export interface A11yProps {
  role?: Role;
  "aria-label"?: string;
  "aria-checked"?: boolean;
  "aria-busy"?: boolean;
  "aria-disabled"?: boolean;
  "aria-hidden"?: boolean;
  "aria-valuenow"?: number;
  "aria-valuemin"?: number;
  "aria-valuemax"?: number;
  testID?: string;
}

export interface ViewProps extends A11yProps {
  style?: StyleProp;
  children?: ReactNode;
}

export interface TextProps extends A11yProps {
  style?: StyleProp;
  children?: ReactNode;
  /** 1 truncates with an ellipsis. Matches RN semantics. */
  numberOfLines?: number;
}

export interface PressableProps extends A11yProps {
  style?: StyleProp;
  children?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}

export interface TextInputProps extends A11yProps {
  autoFocus?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp;
  value?: string;
  placeholder?: string;
  placeholderTextColor?: string;
  onChangeText?: (value: string) => void;
  editable?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
}

export interface PlatformAdapter {
  View: (props: ViewProps) => ReactNode;
  Text: (props: TextProps) => ReactNode;
  Pressable: (props: PressableProps) => ReactNode;
  TextInput: (props: TextInputProps) => ReactNode;
  /** The OS light/dark preference, kept live. Drives the default theme. */
  useColorScheme: () => "light" | "dark";
  /** Lining figures for money and times, so columns of numbers stop jittering. */
  tabularNums: Style;
}
