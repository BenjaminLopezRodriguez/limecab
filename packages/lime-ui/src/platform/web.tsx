/**
 * Web adapter — exists so browser consumers (a design lab, a Storybook, a marketing page)
 * can render the same components. Native is the quality bar; this maps the RN-shaped API
 * onto DOM as faithfully as the box models allow.
 */
import { useState, useSyncExternalStore, type CSSProperties } from "react";
import type {
  PlatformAdapter,
  PressableProps,
  Style,
  StyleProp,
  TextInputProps,
  TextProps,
  ViewProps,
} from "./types.ts";

/**
 * React Native's axis shorthands. DOM has no `padding-horizontal`, and React drops the
 * property silently, so every one of these has to be expanded or the spacing just vanishes.
 */
const AXIS: Record<string, readonly [string, string]> = {
  paddingHorizontal: ["paddingLeft", "paddingRight"],
  paddingVertical: ["paddingTop", "paddingBottom"],
  marginHorizontal: ["marginLeft", "marginRight"],
  marginVertical: ["marginTop", "marginBottom"],
};

function flatten(style: StyleProp): CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten)) as CSSProperties;
  const flat = { ...style } as Record<string, unknown>;

  for (const [shorthand, sides] of Object.entries(AXIS)) {
    if (!(shorthand in flat)) continue;
    const value = flat[shorthand];
    delete flat[shorthand];
    // An explicit single side still wins over the axis it sits on, as it does in RN.
    for (const side of sides) if (flat[side] === undefined) flat[side] = value;
  }

  // RN borders are solid unless told otherwise, and DOM's `border: none` reset below would
  // otherwise swallow every borderWidth the components set.
  if (flat.borderWidth !== undefined && flat.borderStyle === undefined) flat.borderStyle = "solid";
  if (flat.borderTopWidth !== undefined && flat.borderTopStyle === undefined) flat.borderTopStyle = "solid";
  // `borderCurve` is iOS's squircle and has no DOM equivalent; it is deliberately left to be
  // dropped rather than faked, since the difference is a few pixels of corner easing.
  // React Native reads a numeric lineHeight as px; React DOM reads it as a unitless multiple
  // of the font size. Left alone, a 48px line box renders as 48 *lines* down the page.
  if (typeof flat.lineHeight === "number") flat.lineHeight = `${flat.lineHeight}px`;

  return flat as CSSProperties;
}

/**
 * React Native's box defaults, restated for DOM: a View is a column flex container, sized
 * border-box, and it does not shrink. Getting these wrong is how a layout ends up looking
 * right in the browser and collapsing on a phone.
 */
const viewBase: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  flexShrink: 0,
  minWidth: 0,
  position: "relative",
};

export function View({ style, children, testID, ...rest }: ViewProps) {
  return (
    <div {...rest} data-testid={testID} style={{ ...viewBase, ...flatten(style) }}>
      {children}
    </div>
  );
}

export function Text({ style, children, numberOfLines, testID, ...rest }: TextProps) {
  const clamp: CSSProperties =
    numberOfLines === 1
      ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }
      : numberOfLines
        ? { overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: numberOfLines } as CSSProperties
        : {};
  return (
    <span {...rest} data-testid={testID} style={{ boxSizing: "border-box", flexShrink: 0, minWidth: 0, ...flatten(style), ...clamp }}>
      {children}
    </span>
  );
}

export function Pressable({ style, children, onPress, disabled, testID, ...rest }: PressableProps) {
  // Mirrors the native adapter's press feedback. Hover is never the only signal that a thing
  // is tappable, because on the primary target there is no hover.
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <button
      {...rest}
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      style={{
        ...viewBase,
        alignItems: "stretch",
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "inherit",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        ...flatten(style),
        ...(pressed && !disabled ? { opacity: 0.75 } : null),
      }}
    >
      {children}
    </button>
  );
}

export function TextInput({
  style,
  value,
  placeholder,
  onChangeText,
  editable,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  placeholderTextColor,
  testID,
  ...rest
}: TextInputProps) {
  const inputMode =
    keyboardType === "numeric" ? "numeric" : keyboardType === "phone-pad" ? "tel" : keyboardType === "email-address" ? "email" : undefined;
  return (
    <input
      {...rest}
      data-testid={testID}
      value={value}
      placeholder={placeholder}
      disabled={editable === false}
      readOnly={editable === false}
      type={secureTextEntry ? "password" : "text"}
      inputMode={inputMode}
      autoCapitalize={autoCapitalize}
      onChange={(e) => onChangeText?.(e.target.value)}
      style={{
        boxSizing: "border-box",
        border: "none",
        outline: "none",
        font: "inherit",
        // Matches the RN prop; DOM only honours it via the pseudo-element, so it is a hint.
        ["--placeholder-color" as string]: placeholderTextColor,
        ...flatten(style),
      }}
    />
  );
}

const DARK = "(prefers-color-scheme: dark)";

export const useColorScheme = (): "light" | "dark" =>
  useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(DARK);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => (window.matchMedia(DARK).matches ? "dark" : "light"),
    // Server render has no media query to ask; light is the neutral assumption.
    () => "light",
  );

export const tabularNums: Style = { fontVariantNumeric: "tabular-nums" };

const adapter: PlatformAdapter = { View, Text, Pressable, TextInput, useColorScheme, tabularNums };
export default adapter;
