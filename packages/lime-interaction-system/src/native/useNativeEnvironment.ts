import { useEffect, useState } from "react";
import { AccessibilityInfo, Keyboard, PixelRatio, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PresentationEnvironment } from "../policy/environment.ts";

/**
 * Measures the real device into the `PresentationEnvironment` the policy layer expects.
 *
 * This is the only place in the native stack that touches the physical device. Everything
 * downstream — extents, occlusion, camera framing — reads these values instead of asking the
 * platform itself, which is what lets the same policy run headless in a test.
 *
 * Nothing here may reach a semantic reducer: keyboard height decides how tall a sheet is, never
 * which surface is primary or what Back means.
 */
export function useNativeEnvironment(): PresentationEnvironment {
  const { width, height } = useWindowDimensions();
  const safeArea = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState({ visible: false, height: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) =>
      setKeyboard({ visible: true, height: e.endCoordinates.height }),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboard({ visible: false, height: 0 }));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (alive) setReducedMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return {
    safeArea: { top: safeArea.top, right: safeArea.right, bottom: safeArea.bottom, left: safeArea.left },
    viewport: { width, height },
    keyboard,
    reducedMotion,
    // Dynamic Type, expressed the way the policy layer wants it: 1 is the system default.
    fontScale: PixelRatio.getFontScale(),
  };
}
