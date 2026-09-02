import { View } from "react-native";
import { IconGlyph, radius, useLimeColors } from "@lime/ui";

/** Small scene-local glyphs for controls not yet present in the vendored production subset. */
export function MagnifierGlyph({ color }: { color?: string }) {
  const c = useLimeColors();
  const ink = color ?? c.foreground;
  return (
    <IconGlyph size={20}>
      <View style={{ width: 18, height: 18 }}>
        <View
          style={{
            width: 13,
            height: 13,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: ink,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: 7,
            height: 1.5,
            right: 0,
            bottom: 2,
            borderRadius: radius.pill,
            backgroundColor: ink,
            transform: [{ rotateZ: "45deg" }],
          }}
        />
      </View>
    </IconGlyph>
  );
}

export function MicrophoneGlyph({ color }: { color?: string }) {
  const c = useLimeColors();
  const ink = color ?? c.foreground;
  return (
    <IconGlyph size={20}>
      <View style={{ width: 18, height: 20, alignItems: "center" }}>
        <View
          style={{
            width: 8,
            height: 12,
            borderRadius: radius.pill,
            borderWidth: 1.5,
            borderColor: ink,
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 7,
            width: 14,
            height: 8,
            borderBottomLeftRadius: radius.pill,
            borderBottomRightRadius: radius.pill,
            borderLeftWidth: 1.5,
            borderRightWidth: 1.5,
            borderBottomWidth: 1.5,
            borderColor: ink,
          }}
        />
        <View style={{ width: 1.5, height: 4, backgroundColor: ink }} />
        <View style={{ width: 8, height: 1.5, borderRadius: radius.pill, backgroundColor: ink }} />
      </View>
    </IconGlyph>
  );
}

export function PinGlyph({ color }: { color?: string }) {
  const c = useLimeColors();
  const ink = color ?? c.foreground;
  return (
    <IconGlyph size={20}>
      <View
        style={{
          width: 15,
          height: 15,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderColor: ink,
          transform: [{ rotateZ: "45deg" }],
        }}
      >
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: ink,
          }}
        />
      </View>
    </IconGlyph>
  );
}
