import { Pressable, View } from "../platform/adapter";
import { radius, surface } from "../tokens/index.ts";
import { useLimeColors } from "../theme/index.tsx";

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const KNOB = 20;
const INSET = (TRACK_HEIGHT - KNOB) / 2;

/**
 * A binary state you flip in place, as opposed to a choice you pick. On is accent — the switch
 * is one of the places state itself is the meaning — and off is a bordered well, so the control
 * still reads as a control with the colour stripped.
 *
 * The track is drawn at 28pt because that is what reads as a switch, but the *target* is the
 * 44pt minimum — the press area is padded out around the track rather than the track being
 * inflated, so the control looks right and is still reachable by a thumb.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const c = useLimeColors();
  const on = Boolean(checked);
  return (
    <Pressable
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onPress={() => onChange?.(!on)}
      style={{
        width: TRACK_WIDTH,
        height: surface.minHitTarget,
        flexShrink: 0,
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View
        aria-hidden
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          borderRadius: radius.pill,
          borderWidth: on ? 0 : 1,
          borderColor: c.border,
          backgroundColor: on ? c.accent : c.muted,
        }}
      >
        <View
          style={{
            position: "absolute",
            top: on ? INSET : INSET - 1,
            left: on ? TRACK_WIDTH - KNOB - INSET : INSET - 1,
            width: KNOB,
            height: KNOB,
            borderRadius: radius.pill,
            backgroundColor: on ? c.accentForeground : c.surface,
          }}
        />
      </View>
    </Pressable>
  );
}
