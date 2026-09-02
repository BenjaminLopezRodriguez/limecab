/**
 * @lime/ui — portable Lime-branded UI SDK.
 *
 * React Native-first, web-renderable. A neutral, restrained foundation with Lime layered on as
 * the brand accent; nothing in here knows about maps, rides, freight, routing, auth or a
 * server, and every prop is presentation.
 */
export * from "./tokens/index.ts";
export * from "./atoms/index.ts";
export * from "./primitives/index.ts";
export {
  LimeThemeProvider,
  useLimeColors,
  useLimeTheme,
  type ColorScheme,
  type LimeTheme,
} from "./theme/index.tsx";
export { typeStyle } from "./style/type-style.ts";
export { boxShadow } from "./style/shadow.ts";
export type {
  Style,
  StyleProp,
  Role,
  A11yProps,
  ViewProps,
  TextProps,
  PressableProps,
  TextInputProps,
  PlatformAdapter,
} from "./platform/types.ts";
