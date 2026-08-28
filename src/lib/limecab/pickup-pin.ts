import { isCourierProduct } from "./courier.ts";
import { isHelpProduct } from "./help.ts";
import type { DriverAppState } from "./driver-state.ts";

export type PinGate = { ok: true } | { ok: false; message: string };

/**
 * Whether this trip asks the rider to present a PIN at the curb.
 *
 * Courier uses a merchant code instead. A Help visit has no curb at all — the
 * rider is at home and the helper is at their door — so it never gates the
 * start on digits; the rider may still show the PIN if they want to check who
 * turned up.
 */
export function ridePinRequired(input: {
  productId: string;
  pickupPin?: string | null;
  enabled?: boolean;
}): boolean {
  if (isCourierProduct(input.productId)) return false;
  if (isHelpProduct(input.productId)) return false;
  if (!input.pickupPin) return false;
  return input.enabled ?? true;
}

/** Start is blocked until the rider's PIN is typed — the driver never sees it. */
export function rideStartAllowed(
  submitted: string | undefined,
  pickupPin: string,
  required: boolean,
): PinGate {
  if (!required) return { ok: true };
  if (submitted?.trim() !== pickupPin) {
    return {
      ok: false,
      message: "Ask the rider for their security PIN to start.",
    };
  }
  return { ok: true };
}

/**
 * Driver-facing trip shape. The digits stay on the server; the client only
 * learns that a PIN is required, and only once the trip is theirs.
 */
export function redactTripPins<
  T extends {
    pickupPin: string;
    deliveryPin: string | null;
    productId: string;
  },
>(
  trip: T,
  assigned: boolean,
  enabled?: boolean,
): Omit<T, "pickupPin" | "deliveryPin"> & {
  pickupPin: null;
  deliveryPin: null;
  pinRequired: boolean;
} {
  return {
    ...trip,
    pickupPin: null,
    deliveryPin: null,
    pinRequired:
      assigned &&
      ridePinRequired({
        productId: trip.productId,
        pickupPin: trip.pickupPin,
        enabled,
      }),
  };
}

/** The overlay is the answer to Start ride at the curb, never sooner. */
export function ridePinBlocksStart(
  scene: DriverAppState,
  pinRequired: boolean,
): boolean {
  return scene === "at_pickup" && pinRequired;
}
