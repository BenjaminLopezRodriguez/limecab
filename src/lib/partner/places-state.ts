/**
 * The one question each Places partner scene asks — same contract as
 * `driverAppQuestion`, so scene components read copy from here instead of
 * hardcoding it in JSX.
 */
export type PlacesPartnerState = "paused" | "live";

export function placesPartnerQuestion(state: PlacesPartnerState): {
  question: string;
  action: string;
  exit: string;
} {
  switch (state) {
    case "paused":
      return {
        question: "Do you want bookings?",
        action: "Go live",
        exit: "Stay paused",
      };
    case "live":
      return {
        question: "Looking for bookings",
        action: "Wait",
        exit: "Go offline",
      };
  }
}

export function reducePlacesPartnerState(
  state: PlacesPartnerState,
  event: "go_live" | "go_offline",
): PlacesPartnerState {
  if (event === "go_live") return "live";
  return "paused";
}
