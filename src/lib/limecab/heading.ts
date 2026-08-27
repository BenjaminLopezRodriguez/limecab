import { distanceMiles } from "./domain.ts";

type Coords = {
  latitude?: number | null;
  longitude?: number | null;
};

export type HeadingTarget = {
  latitude: number;
  longitude: number;
};

function point(coords: Coords, address = "") {
  if (typeof coords.latitude !== "number" || typeof coords.longitude !== "number") {
    return null;
  }
  return {
    address,
    latitude: coords.latitude,
    longitude: coords.longitude,
  };
}

/**
 * Uber Destination Mode, cheaply: the dropoff is closer to the heading than
 * the pickup is (the trip ends toward home), or the dropoff is already nearby.
 */
export function offerHeadsToward(
  trip: {
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    destinationLatitude?: number | null;
    destinationLongitude?: number | null;
  },
  heading: HeadingTarget | null,
): boolean {
  if (!heading) return true;
  const pickup = point({
    latitude: trip.pickupLatitude,
    longitude: trip.pickupLongitude,
  });
  const dest = point({
    latitude: trip.destinationLatitude,
    longitude: trip.destinationLongitude,
  });
  if (!pickup || !dest) return true;

  const destToHeading = distanceMiles(dest, {
    address: "",
    latitude: heading.latitude,
    longitude: heading.longitude,
  });
  const pickupToHeading = distanceMiles(pickup, {
    address: "",
    latitude: heading.latitude,
    longitude: heading.longitude,
  });

  return destToHeading + 0.5 <= pickupToHeading || destToHeading <= 5;
}
