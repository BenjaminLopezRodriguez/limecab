/**
 * Minimal scale covering ~92% of production usage across service-app + limecab.
 * Deliberately NOT every accidental one-off: py-3.5 (14) and pr-12 (48) stay outliers.
 * Tailwind unit = 4px.
 */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;

/** Half-steps, chip internals only. */
export const spacingHalf = { xs: 6, sm: 10 } as const;

/** Sheet content gutters. Source: service-sheet.tsx:199. */
export const gutter = { mobile: 20, desktop: 24 } as const;
