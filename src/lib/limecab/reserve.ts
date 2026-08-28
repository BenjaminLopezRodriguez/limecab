/**
 * Lime Reserve — a pickup clock, not a calendar.
 *
 * Next half-hours for today or tomorrow. The quote stores the chosen instant
 * client-side; there is no reservations table.
 */

export function upcomingHalfHours(
  day: "today" | "tomorrow",
  count = 8,
  from = new Date(),
): Date[] {
  const start = new Date(from);
  start.setSeconds(0, 0);
  start.setMilliseconds(0);

  if (day === "tomorrow") {
    start.setDate(start.getDate() + 1);
    start.setHours(8, 0, 0, 0);
  } else {
    const minutes = start.getMinutes();
    const add = minutes === 0 ? 0 : minutes <= 30 ? 30 - minutes : 60 - minutes;
    if (add === 0) start.setMinutes(start.getMinutes() + 30);
    else start.setMinutes(start.getMinutes() + add);
  }

  return Array.from({ length: count }, (_, index) => {
    const slot = new Date(start);
    slot.setMinutes(start.getMinutes() + index * 30);
    return slot;
  });
}

export function formatPickupClock(at: Date): string {
  return at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function reservedLabel(at: Date): string {
  return `Reserved for ${formatPickupClock(at)}`;
}
