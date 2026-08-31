import { vehicleLabel, type Trip } from "@/lib/limecab/domain";

/** Opens the device share sheet when available. Returns whether share was attempted. */
export function shareTripDetails(trip: Trip, destinationLine: string): boolean {
  if (typeof navigator === "undefined" || !("share" in navigator)) {
    return false;
  }
  void navigator
    .share({
      title: "My LimeCab ride",
      text: `I'm riding with ${trip.driver.name} in a ${vehicleLabel(
        trip.driver.vehicle,
      )}${destinationLine ? `, heading to ${destinationLine}` : ""}.`,
    })
    .catch(() => undefined);
  return true;
}
