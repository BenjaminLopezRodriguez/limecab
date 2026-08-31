import type { BackContext, BackDisposition, BackResolver } from "../core/back.ts";

/**
 * Lab-only BackResolver — models OBSERVED product behavior, not a universal precedence law.
 * Production has 16 backward mechanisms and no arbiter; this is a demonstration model only.
 */

export const riderHomeBack: BackResolver = () => ({ type: "consume" });

export const riderDraftBack: BackResolver = (ctx) => {
  if (ctx.hasInterrupt) return { type: "return-interrupt" };
  if (ctx.workflowCanRegress) return { type: "regress-scene" };
  return { type: "delegate-to-host" };
};

export const riderLiveBack: BackResolver = (ctx) => {
  if (ctx.hasInterrupt) return { type: "return-interrupt" };
  if (ctx.liveWorkActive) return { type: "minimize-live-work" };
  return { type: "consume" };
};

export const driverBack: BackResolver = (ctx) => {
  if (ctx.hasInterrupt) return { type: "return-interrupt" };
  if (ctx.workflowCanRegress) return { type: "regress-scene" };
  return { type: "delegate-to-host" };
};

export const freightBack: BackResolver = (ctx) => {
  if (ctx.surfaceHistoryDepth > 0) return { type: "return-interrupt" };
  if (ctx.liveWorkActive) return { type: "minimize-live-work" };
  if (ctx.workflowCanRegress) return { type: "regress-scene" };
  return { type: "exit-product" };
};

export function resolveBack(
  product: "rider" | "driver" | "freight",
  scene: "home" | "draft" | "live",
  context: BackContext,
): BackDisposition {
  if (product === "rider" && scene === "home") return riderHomeBack(context);
  if (product === "rider" && scene === "live") return riderLiveBack(context);
  if (product === "rider") return riderDraftBack(context);
  if (product === "driver") return driverBack(context);
  return freightBack(context);
}

export const BACK_DISPOSITIONS: BackDisposition["type"][] = [
  "dismiss-transient",
  "return-interrupt",
  "regress-scene",
  "minimize-live-work",
  "exit-product",
  "delegate-to-host",
  "consume",
];
