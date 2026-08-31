/**
 * Border is Lime's primary elevation cue (ring-1 ring-border); shadow is reserved for
 * things floating over the map. Source: location-trigger.tsx:44, map-marker.tsx:68.
 */
export interface Shadow { x: number; y: number; blur: number; color: string }

export const elevation = {
  floatingControl: { x: 0, y: 4, blur: 16, color: "rgba(26,24,20,0.12)" },
  navPill:         { x: 0, y: 8, blur: 28, color: "rgba(26,24,20,0.12)" },
  drawer:          { x: 0, y: -8, blur: 32, color: "rgba(26,24,20,0.08)" },
  mapMarker:       { x: 0, y: 2, blur: 8, color: "rgba(0,0,0,0.28)" },
  hairline:        { x: 0, y: 1, blur: 2, color: "rgba(26,24,20,0.05)" },
} as const satisfies Record<string, Shadow>;
