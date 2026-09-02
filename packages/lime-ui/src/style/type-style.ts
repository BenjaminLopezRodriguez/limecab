import type { Style } from "../platform/types.ts";
import type { TypeStyle } from "../tokens/typography.ts";

/**
 * Token typography → a platform style object.
 *
 * `letterSpacing` is authored in em (CSS-native); React Native wants absolute px, so it is
 * multiplied by the size here. `fontWeight` is stringified because RN only accepts the
 * numeric-string form on every platform, and CSS accepts it too.
 */
export function typeStyle(s: TypeStyle): Style {
  return {
    fontSize: s.size,
    fontWeight: String(s.weight),
    letterSpacing: s.letterSpacing * s.size,
  };
}
