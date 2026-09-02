import type { Style } from "../platform/types.ts";
import type { Shadow } from "../tokens/elevation.ts";

/**
 * Shadow token → style. One implementation for both platforms: React Native has understood
 * the CSS `boxShadow` string since 0.76, which replaces the legacy `shadowOffset`/`shadowRadius`
 * /`elevation` props — those never matched between iOS and Android anyway.
 */
export function boxShadow({ x, y, blur, color }: Shadow): Style {
  return { boxShadow: `${x}px ${y}px ${blur}px ${color}` };
}
