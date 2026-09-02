import Svg, { Circle, Line, Path, Polyline, Rect } from "react-native-svg";
import { useLimeColors } from "@lime/ui";
import { ICONS, type IconName, type IconPaths } from "./icons.ts";

/**
 * The native counterpart of production's `ui/icon.tsx`.
 *
 * Size, stroke and colour live here so every screen draws the same weight — 1.5 stroke on a 24
 * viewBox, exactly as the web renderer does. A caller passes a name and a size and gets a glyph
 * that matches the web app rather than an approximation of it.
 */
const ELEMENTS = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline } as const;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.5,
}: {
  name: IconName;
  size?: number;
  /** Defaults to the current foreground role, matching web's `currentColor`. */
  color?: string;
  strokeWidth?: number;
}) {
  const c = useLimeColors();
  const stroke = color ?? c.foreground;
  const paths = ICONS[name] as IconPaths;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths.map(([element, attrs], index) => {
        const Element = ELEMENTS[element as keyof typeof ELEMENTS] ?? Path;
        // Upstream carries a `key` in the attribute bag; spreading it is a React warning, and
        // the index is the stable identity here anyway since the path list never reorders.
        const { key: _upstreamKey, ...rest } = attrs as Record<string, unknown>;
        return (
          <Element
            key={index}
            {...(rest as object)}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        );
      })}
    </Svg>
  );
}
