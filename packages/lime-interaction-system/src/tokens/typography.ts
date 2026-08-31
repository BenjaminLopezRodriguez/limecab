/**
 * Roles recurring >=3 times in production. Families: Geist (body), Plus Jakarta (heading).
 * Source: app/layout.tsx:4,11,27; globals.css:174-179.
 * letterSpacing is em — native multiplies by fontSize.
 */
export interface TypeStyle { size: number; weight: number; letterSpacing: number }

export const typography = {
  display:     { size: 52, weight: 600, letterSpacing: -0.04 },
  headlineXl:  { size: 34, weight: 600, letterSpacing: -0.03 },
  headline:    { size: 22, weight: 600, letterSpacing: -0.02 },
  subhead:     { size: 19, weight: 600, letterSpacing: -0.02 },
  bodyStrong:  { size: 17, weight: 600, letterSpacing: -0.01 },
  body:        { size: 15, weight: 400, letterSpacing: 0 },
  metadata:    { size: 13, weight: 500, letterSpacing: 0 },
  eyebrow:     { size: 11, weight: 500, letterSpacing: 0.12 },
  cta:         { size: 15, weight: 600, letterSpacing: -0.01 },
} as const satisfies Record<string, TypeStyle>;
