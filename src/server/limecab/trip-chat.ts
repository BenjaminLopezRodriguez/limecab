import type { TripStatus } from "@/server/limecab/state";

export type ChatRole = "rider" | "driver";

export type ChatParty = {
  userId: string;
  driverId: string | null;
  status: TripStatus;
};

export type ChatAccess =
  | { ok: true; role: ChatRole }
  | { ok: false; code: "NOT_FOUND" | "FORBIDDEN" | "UNAVAILABLE" };

/**
 * Who may see a trip thread. Only the rider and the assigned driver.
 * Matching has to have happened — there is no one to write to before that.
 */
export function resolveChatAccess(input: {
  userId: string;
  trip: ChatParty | null;
  assignedDriverUserId: string | null;
}): ChatAccess {
  if (!input.trip) return { ok: false, code: "NOT_FOUND" };

  const isRider = input.trip.userId === input.userId;
  const isDriver =
    input.trip.driverId !== null &&
    input.assignedDriverUserId === input.userId;

  if (!isRider && !isDriver) return { ok: false, code: "FORBIDDEN" };
  if (!input.trip.driverId) return { ok: false, code: "UNAVAILABLE" };

  return { ok: true, role: isRider ? "rider" : "driver" };
}

/** A matched trip keeps its thread after it ends, including a cancel. */
export function chatMayRead(status: TripStatus): boolean {
  return status !== "requested";
}

/** Write while the job is live, and after it finishes. Not after a cancel. */
export function chatMaySend(status: TripStatus): boolean {
  return (
    status === "matched" ||
    status === "arriving" ||
    status === "in_progress" ||
    status === "complete"
  );
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first || null;
}
