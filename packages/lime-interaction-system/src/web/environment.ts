import { useEffect, useState } from "react";
import type { PresentationEnvironment } from "../policy/environment.ts";

/**
 * The web renderer's job: MEASURE the platform and hand core a PresentationEnvironment.
 * Core never reads window itself — that boundary is enforced by tests/contract.test.ts.
 */
function read(): PresentationEnvironment {
  const styles = getComputedStyle(document.documentElement);
  const inset = (name: string) => Number.parseFloat(styles.getPropertyValue(name)) || 0;
  return {
    safeArea: {
      top: inset("--sa-top"), right: inset("--sa-right"),
      bottom: inset("--sa-bottom"), left: inset("--sa-left"),
    },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    keyboard: { visible: false, height: 0 },
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    fontScale: 1,
  };
}

export function usePresentationEnvironment(
  override?: Partial<PresentationEnvironment>,
): PresentationEnvironment {
  const [env, setEnv] = useState<PresentationEnvironment>(read);
  useEffect(() => {
    const onResize = () => setEnv(read());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return { ...env, ...override };
}
