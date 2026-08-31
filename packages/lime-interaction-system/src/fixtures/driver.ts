/** Deterministic driver fixtures. */

export type DriverOffer = {
  id: string;
  product: string;
  total: string;
  distance: string;
  duration: string;
  arrival: string;
  pickup: string;
  destination: string;
};

export const DRIVER_OFFER: DriverOffer = {
  id: "offer-1",
  product: "LimeGo",
  total: "$18.40",
  distance: "5.2 mi",
  duration: "18 min",
  arrival: "4 min",
  pickup: "1247 Maple Ave",
  destination: "400 S Hope St",
};

export const DRIVER_JOB = {
  ...DRIVER_OFFER,
  status: "to_pickup" as const,
  riderName: "Alex Chen",
  riderPhone: "(555) 201-4488",
  pinRequired: true,
  meetingPoint: "Curbside on Maple Ave",
};

export const EARNINGS_TRIP = {
  headline: "Yesterday · 6:42 PM",
  total: "$24.10",
  lines: [
    { label: "Fare", value: "$18.40" },
    { label: "Tip", value: "$4.00" },
    { label: "Bonus", value: "$1.70" },
  ],
  route: "Ontario → Downtown LA",
};

export const REST_STOPS = [
  { id: "coffee", label: "Blue Bottle", category: "coffee" as const },
  { id: "rest", label: "Rest area 42", category: "shelter" as const },
];

export const TREND_BARS = [
  { hour: "6a", value: 0.2 },
  { hour: "9a", value: 0.85 },
  { hour: "12p", value: 0.6 },
  { hour: "3p", value: 0.45 },
  { hour: "6p", value: 0.95 },
  { hour: "9p", value: 0.35 },
];
