/** Deterministic profile fixtures. */

export const PROFILE = {
  name: "Alex Chen",
  phone: "(555) 201-4488",
  email: "alex@example.com",
  facts: ["Member since 2024", "4.92 rating"],
};

export const VEHICLES = [
  { id: "v1", make: "Toyota", model: "Prius", year: 2021, plate: "8KJT402", color: "Silver" },
  { id: "v2", make: "Honda", model: "Civic", year: 2019, plate: "7XYZ891", color: "Blue" },
];

export const CHAT_MESSAGES = [
  { id: "m1", from: "driver" as const, text: "I'm pulling up now", time: "6:42 PM" },
  { id: "m2", from: "rider" as const, text: "Great, I'm at the curb", time: "6:43 PM" },
  { id: "m3", from: "driver" as const, text: "Silver Prius", time: "6:43 PM" },
];

export const SUPPORT_TOPICS = [
  "Trip issue",
  "Payment problem",
  "Lost item",
  "Safety concern",
  "Account help",
];
