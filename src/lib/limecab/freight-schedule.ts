/**
 * Freight runs against appointments, and a truck is early or late against a
 * clock the driver did not set. Rides have nothing like it: a rider waits for
 * you, a receiver closes the dock at five.
 *
 * Pure on purpose — the sheet and the duty shell both read it, so it must not
 * reach for the network, the map, or a component. `null` everywhere means "we
 * do not know", never a guessed minute: an invented ETA against a real
 * appointment is the kind of lie that gets a driver turned away at a gate.
 */

/** Metres. Below `ARRIVED` the driver is on the property, not near it. */
const ARRIVED_M = 250;
const NEAR_M = 1_609; // one mile

/**
 * Interstate average including fuel, scales and traffic — deliberately
 * pessimistic. 55 mph ≈ 24.6 m/s; this is 22 m/s (~49 mph).
 *
 * ponytail: a flat average, not a routing ETA. Swap in the directions API's
 * duration when a leg is requested — the shape below does not change.
 */
const AVG_SPEED_MPS = 22;

export type ProximityBand = "far" | "near" | "arrived";

export function proximityBand(meters: number | null): ProximityBand | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters <= ARRIVED_M) return "arrived";
  if (meters <= NEAR_M) return "near";
  return "far";
}

/** Great-circle metres. Good enough to decide a band; not a route length. */
export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function etaFromDistance(
  meters: number | null,
  now: Date = new Date(),
): Date | null {
  if (meters == null || !Number.isFinite(meters) || meters < 0) return null;
  return new Date(now.getTime() + (meters / AVG_SPEED_MPS) * 1000);
}

export type ScheduleStanding = {
  /** Minutes early (positive) or late (negative) against the appointment. */
  deltaMinutes: number;
  late: boolean;
  /** "18 min early" · "16 min late" · "on time". Never a bare number. */
  label: string;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Beyond this, "early" stops being a schedule and starts being a calendar.
 * A truck 19 hours ahead of its appointment is not early — it is not due
 * yet, and saying "19 hr 21 min early" invites a driver to read pressure
 * that is not there. Past the cap the surface shows the appointment alone.
 */
const STANDING_HORIZON_MIN = 12 * 60;

/**
 * Where this truck stands against its appointment. Both halves must be real:
 * no appointment, or no ETA, means no standing — not "on time".
 */
export function scheduleStanding(
  appointmentAt: Date | string | null | undefined,
  etaAt: Date | string | null | undefined,
): ScheduleStanding | null {
  const appointment = asDate(appointmentAt);
  const eta = asDate(etaAt);
  if (!appointment || !eta) return null;

  const deltaMinutes = Math.round(
    (appointment.getTime() - eta.getTime()) / 60_000,
  );
  if (Math.abs(deltaMinutes) > STANDING_HORIZON_MIN) return null;
  // Inside five minutes either way, "early"/"late" is noise, not information.
  if (Math.abs(deltaMinutes) < 5) {
    return { deltaMinutes, late: deltaMinutes < 0, label: "on time" };
  }
  const magnitude = Math.abs(deltaMinutes);
  const unit =
    magnitude >= 60
      ? `${Math.floor(magnitude / 60)} hr ${magnitude % 60} min`
      : `${magnitude} min`;
  return {
    deltaMinutes,
    late: deltaMinutes < 0,
    label: `${unit} ${deltaMinutes < 0 ? "late" : "early"}`,
  };
}

/** Clock time a driver reads at a glance. Null in, null out. */
export function clockLabel(at: Date | string | null | undefined): string | null {
  const date = asDate(at);
  if (!date) return null;
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
