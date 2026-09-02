/**
 * Visual tokens now live in `@lime/ui` — they are kit, usable by any app. Re-exported here so
 * the lab's existing imports keep working, alongside the metrics that stayed behind because
 * they describe *this* product's shell rather than a reusable control.
 */
export * from "@lime/ui/tokens";
export * from "./chrome.ts";
export * from "./color-compat.ts";
