import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Button,
  ChoiceRow,
  ChoiceSection,
  Input,
  radius,
  spacing,
  typeStyle,
  typography,
  useLimeColors,
} from "@lime/ui";
import type { PlaceSearchAdapter, PlaceSuggestion } from "../../adapters/places.ts";
import { Icon } from "../Icon.tsx";
import { MicrophoneGlyph, PinGlyph } from "./scene-icons.tsx";

const noop = () => {};

/** Search is transient; selecting a result is the point at which the route task progresses. */
export interface SearchSceneProps {
  adapter: PlaceSearchAdapter;
  placeholder?: string;
  onBack?: () => void;
  onChooseOnMap?: () => void;
  onVoice?: () => void;
  onSelect: (place: PlaceSuggestion) => void;
}

export function SearchScene({ data }: { data: SearchSceneProps }) {
  const {
    adapter,
    placeholder = "Search an address…",
    onBack,
    onChooseOnMap,
    onVoice,
    onSelect,
  } = data;
  const c = useLimeColors();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setResults([]);
      return;
    }

    let live = true;
    // Production clears the area while the next query is pending; no skeleton or empty row.
    setResults([]);
    const timer = setTimeout(() => {
      void adapter.search(normalized).then(
        (found) => {
          if (live) setResults(found);
        },
        () => {
          if (live) setResults([]);
        },
      );
    }, 250);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [adapter, query]);

  return (
    <View style={{ gap: spacing.md, paddingTop: spacing.xs, flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginLeft: -spacing.md }}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          onPress={onBack}
          style={{ width: 44, height: 44 }}
        >
          <View style={{ transform: [{ rotateZ: "180deg" }] }}>
            <Icon name="ArrowRight01" size={20} />
          </View>
        </Button>
        <Text style={{ ...typeStyle(typography.bodyStrong), color: c.foreground, fontWeight: "500" }}>
          Where to?
        </Text>
      </View>

      <View
        style={{
          height: 96,
          borderRadius: radius.control,
          borderCurve: "continuous",
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: c.border,
          backgroundColor: c.surface,
          overflow: "hidden",
        }}
      >
        <View
          aria-hidden
          style={{
            position: "absolute",
            left: 20,
            top: 24,
            width: StyleSheet.hairlineWidth,
            height: 48,
            backgroundColor: c.border,
          }}
        />
        <View
          aria-hidden
          style={{ position: "absolute", left: 16, top: 19, width: 10, height: 10, borderRadius: radius.pill, backgroundColor: c.accent }}
        />
        <View
          aria-hidden
          style={{ position: "absolute", left: 16, top: 67, width: 10, height: 10, borderRadius: 2, backgroundColor: c.foreground }}
        />
        <View
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 48,
            height: StyleSheet.hairlineWidth,
            backgroundColor: c.border,
          }}
        />

        <View style={{ height: 48, justifyContent: "center", paddingLeft: 40, paddingRight: 52 }}>
          <Text numberOfLines={1} style={{ ...typeStyle(typography.body), color: c.foreground }}>
            Current location
          </Text>
        </View>
        <View style={{ height: 48, flexDirection: "row", alignItems: "center", paddingLeft: 40, paddingRight: 44 }}>
          <Input
            embedded
            autoFocus
            value={query}
            placeholder={placeholder}
            onChangeText={setQuery}
            aria-label="Search for a destination"
          />
        </View>

        <Button
          variant="secondary"
          size="xs"
          aria-label="Add stop"
          onPress={noop}
          style={{ position: "absolute", right: spacing.sm, top: 32, width: 32, paddingHorizontal: 0 }}
        >
          <Text style={{ fontSize: 22, lineHeight: 24, color: c.mutedForeground }}>+</Text>
        </Button>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Book by voice"
          onPress={onVoice}
          style={{ position: "absolute", right: spacing.sm, top: 52, width: 32, height: 40, alignItems: "center", justifyContent: "center" }}
        >
          <MicrophoneGlyph color={c.mutedForeground} />
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Set location with pin"
        onPress={onChooseOnMap}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          minHeight: 56,
          marginHorizontal: -spacing.sm,
          paddingHorizontal: spacing.sm,
        }}
      >
        <View
          aria-hidden
          style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: c.muted }}
        >
          <PinGlyph color={c.mutedForeground} />
        </View>
        <Text style={{ ...typeStyle(typography.body), color: c.foreground, fontWeight: "500" }}>
          Set location with pin
        </Text>
      </Pressable>

      {results.length > 0 ? (
        <ChoiceSection title="Places" gutter={0}>
          {results.map((place) => (
            <ChoiceRow
              key={place.id}
              density="compact"
              glyph={<PinGlyph color={c.foreground} />}
              title={place.address}
              detail={place.context}
              onSelect={() => onSelect(place)}
            />
          ))}
        </ChoiceSection>
      ) : null}
    </View>
  );
}
