/**
 * What time of day it is, in the words a driver reads off a dash mount.
 *
 * This is *display* copy for the hunting peek, not a second question:
 * `driverAppQuestion("online")` still owns the a11y headline. Uber shows
 * "It's dinner time" because the hour is the only thing it can honestly say
 * while nothing is being offered — there is no promise here, and no demand
 * claim either.
 */

export type Daypart = { headline: string; sub: string };

const CHECK_THE_MAP = "Check the map for busy areas";

/** Local hour, so a driver in Pasadena is not told it is dinner at 11am. */
export function daypart(now: Date = new Date()): Daypart {
  const hour = now.getHours();
  if (hour >= 5 && hour <= 10)
    return { headline: "It’s morning", sub: CHECK_THE_MAP };
  if (hour >= 11 && hour <= 14)
    return { headline: "It’s lunch time", sub: CHECK_THE_MAP };
  if (hour >= 15 && hour <= 16)
    return { headline: "Afternoon lull", sub: CHECK_THE_MAP };
  if (hour >= 17 && hour <= 21)
    return { headline: "It’s dinner time", sub: CHECK_THE_MAP };
  return { headline: "Looking for rides", sub: "Offers will show up here" };
}
