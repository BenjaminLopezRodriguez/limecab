"use client";

import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/**
 * Viewport class for *presentation* only.
 *
 * Never branch business logic on this — the state machine is identical at
 * every width. It exists so one call site can render a drawer or a panel.
 */
export function useServiceAppMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
