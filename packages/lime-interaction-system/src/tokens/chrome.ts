/** Chrome metrics. Source: limecab-shell.tsx:83,88,303,315; map-overlay.ts:14-19. */
export const chrome = {
  riderHeader: { mobile: 104, desktop: 60 },
  navPill: { tabMinHeight: 52, tabMinWidth: 72, clearance: 128 },
  floatingControl: 44,
  mapRouteBar: 44,
  /** Camera padding. map-overlay.ts:14-17 — panel value is desktop reserve (24*16+48). */
  mapPadding: { top: 72, gutter: 32, desktopPanel: 432 },
} as const;

/** Single source for the breakpoint triplicated in production
 *  (use-service-app-mobile.ts:5, map-overlay.ts:64, globals.css:188). */
export const breakpointMd = 768;
