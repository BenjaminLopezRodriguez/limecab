/** Driver payout week is local to the service area, not the server's UTC clock. */
export const DRIVER_TZ = "America/Los_Angeles";

export function civilDateInZone(date: Date, timeZone = DRIVER_TZ): string {
  return date.toLocaleDateString("en-CA", { timeZone });
}

function addCivilDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-");
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day) + days),
  )
    .toISOString()
    .slice(0, 10);
}

/** Monday of the week containing `date`, as a civil YYYY-MM-DD in DRIVER_TZ. */
export function mondayCivilDateInZone(
  date = new Date(),
  timeZone = DRIVER_TZ,
): string {
  const today = civilDateInZone(date, timeZone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const fromMonday: Record<string, number> = {
    Sun: 6,
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
  };
  return addCivilDays(today, -(fromMonday[weekday] ?? 0));
}
