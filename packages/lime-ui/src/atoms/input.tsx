import { useState } from "react";
import { Text, TextInput, View } from "../platform/adapter";
import type { TextInputProps } from "../platform/types.ts";
import { radius, spacing, surface, typography } from "../tokens/index.ts";
import { typeStyle } from "../style/type-style.ts";
import { useLimeColors } from "../theme/index.tsx";

export interface InputProps
  extends Pick<
    TextInputProps,
    "value" | "placeholder" | "onChangeText" | "secureTextEntry" | "autoCapitalize" | "keyboardType" | "onFocus" | "onBlur"
  > {
  /** Message shown beneath the field; also flips the field to its invalid treatment. */
  error?: string;
  disabled?: boolean;
  /** Leading magnifier and the padding to clear it. */
  search?: boolean;
  /** Raises the keyboard on mount — for a surface that exists to be typed into. */
  autoFocus?: boolean;
  /** Removes standalone field chrome when the input belongs to a larger field group. */
  embedded?: boolean;
  "aria-label"?: string;
}

const GLYPH_WELL = 20;

/**
 * Neutral at rest. The accent appears only on focus — that is the one moment the field is the
 * thing you are working in, and an invalid field outranks even that.
 */
export function Input({
  error,
  disabled,
  search,
  autoFocus,
  embedded,
  "aria-label": ariaLabel,
  onFocus,
  onBlur,
  ...field
}: InputProps) {
  const c = useLimeColors();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? c.destructive : focused ? c.accent : c.input;

  return (
    <View style={{ gap: spacing.xs, flex: embedded ? 1 : undefined, minWidth: embedded ? 0 : undefined }}>
      <View>
        {search ? (
          <Text
            aria-hidden
            style={{
              position: "absolute",
              left: spacing.lg,
              top: 0,
              bottom: 0,
              lineHeight: surface.cta.default,
              color: c.mutedForeground,
            }}
          >
            ⌕
          </Text>
        ) : null}
        <TextInput
          {...field}
          autoFocus={autoFocus}
          aria-label={ariaLabel}
          aria-disabled={disabled || undefined}
          editable={!disabled}
          placeholderTextColor={c.mutedForeground}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          style={{
            width: "100%",
            height: surface.cta.default,
            paddingLeft: embedded ? 0 : search ? spacing.xl + GLYPH_WELL : spacing.xl,
            paddingRight: embedded ? 0 : spacing.xl,
            borderRadius: embedded ? 0 : radius.pill,
            borderWidth: embedded ? 0 : 1,
            borderColor,
            backgroundColor: embedded ? "transparent" : c.surface,
            color: c.foreground,
            opacity: disabled ? 0.4 : 1,
            ...typeStyle(typography.body),
          }}
        />
      </View>
      {error ? (
        <Text role="alert" style={{ ...typeStyle(typography.metadata), color: c.destructive }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
