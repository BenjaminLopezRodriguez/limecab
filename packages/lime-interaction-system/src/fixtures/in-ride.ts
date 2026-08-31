/**
 * In-ride fixture data modeled on Uber during-ride screenshots.
 * Demo only — not production trip types.
 */
export const IN_RIDE = {
  dropoffLabel: "Dropoff at 1:37 AM",
  productLabel: "LimeGo details",
  destinationLabel: "Heading Home",
  destinationAddress: "5016 Cloverly Ave",
  shareContact: "Sylvia",
  fareCents: 895,
  fareDisplay: "$8.95",
  payment: { brand: "Visa", last4: "1936", wallet: "Personal" },
  loyalty: { program: "Lime Plus", benefit: "Earning 6% Lime Plus credits" },
  driver: {
    name: "Cesar",
    rating: "5.00",
    plate: "7LNK940",
    vehicle: "Dark Gray Toyota Prius",
    initial: "C",
  },
  tips: [2, 4, 5] as const,
  tipNote: "We'll deliver your tip after the ride.",
  promo: {
    headline: "Save your favorite spots",
    body: "Store addresses for easy booking next time!",
    cta: "Save an address",
  },
  safety: {
    tools: [
      { id: "911", label: "Contact 911", glyph: "🚨", emphasis: "emergency" as const },
      { id: "agent", label: "Contact safety agent", glyph: "💬" },
      { id: "audio", label: "Record audio", glyph: "🎙️" },
      { id: "share", label: "Share trip status", glyph: "📡" },
      { id: "report", label: "Report safety issue", glyph: "📋" },
    ],
    protection: [
      { id: "detour", badge: "Active", title: "Route check", body: "We can help if a ride is disrupted or goes off course." },
      { id: "pin", badge: "Active", title: "PIN verification", body: "Confirm your driver with a one-time code." },
      { id: "share", badge: "Optional", title: "Share trip", body: "Let someone follow your ride in real time." },
    ],
  },
  activity: {
    ongoing: {
      dropoff: "1:37 AM dropoff",
      product: "LimeGo",
      destination: "Heading to 5016 Cloverly Ave.",
      progress: 62,
    },
    past: [
      { id: "p1", address: "6002 Golden West Ave", when: "Aug 29 · 8:31 AM", amount: "$0.00", status: "Canceled" },
      { id: "p2", address: "400 S Hope St", when: "Aug 28 · 6:42 PM", amount: "$22.90", status: "Completed" },
    ],
  },
} as const;
