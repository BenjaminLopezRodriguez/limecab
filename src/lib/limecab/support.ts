export const SUPPORT_TOPICS = {
  fare: {
    title: "Fare looks wrong",
    hint: "We’ll look at this trip’s fare, not a general billing inbox.",
  },
  lost_item: {
    title: "I left something",
    hint: "Describe the item and where you last saw it. We pass this to the driver.",
  },
  driver: {
    title: "Driver or safety",
    hint: "Tell us what happened. If you are in danger, call 911 first.",
  },
  other: {
    title: "Something else",
    hint: "Anything about this trip that isn’t a fare or a lost item.",
  },
} as const;

export type SupportTopic = keyof typeof SUPPORT_TOPICS;

export function isSupportTopic(value: string): value is SupportTopic {
  return value in SUPPORT_TOPICS;
}
