/**
 * Search-input manager.
 *
 * SurfaceManager sits the overlay. GeocodeAdapter finds places. This answers
 * a different question: *what is this field for?* Ride needs a destination.
 * Help and Shop often do not — the place is here, or someone else's door, or
 * (later) a query that is not a place at all.
 *
 * Product code, not the kit. The scene stays generic; LimeCab passes the
 * contract in through slots.
 */

export type BookingMode = "ride" | "courier" | "reserve" | "shop" | "help";

export type SearchTarget = "pickup" | "destination" | `stop:${number}`;

export type SearchFieldRole =
  | "destination"
  | "origin"
  | "stop"
  | "visit"
  | "store"
  | "dropoff";

/**
 * What leaving the scene may commit.
 *
 * `query` is the AI-search seam: a string that is not (yet) a place. Nothing
 * in the overlay runs a model; the contract just refuses to pretend every
 * keystroke is an address.
 */
export type SearchCommit = "place" | "place_or_here" | "query";

export type SearchShortcut = "use_here" | "send_to";

/** Who the place belongs to. Inline, not a second scene. */
export type SearchAudience = "self" | "other";

export type SearchInputContract = {
  role: SearchFieldRole;
  commit: SearchCommit;
  title: string;
  placeholder: string;
  ariaLabel: string;
  /** Connected pickup/destination stack. Off when the scene has one place. */
  showRoute: boolean;
  allowStops: boolean;
  originLabel: string;
  destinationLabel: string;
  shortcuts: SearchShortcut[];
  /** Ride-style: a dropoff must be chosen to leave. */
  destinationRequired: boolean;
  /** Current location is a complete answer for this field. */
  hereCompletes: boolean;
};

export function searchInputContract({
  mode,
  target,
  audience = "self",
}: {
  mode: BookingMode;
  target: SearchTarget;
  audience?: SearchAudience;
}): SearchInputContract {
  const other = audience === "other";
  const theirAddress = "Their address…";
  const stop = stopTarget(target);

  if (mode === "help") {
    return {
      role: "visit",
      commit: "place_or_here",
      title: "Where is the house?",
      placeholder: other ? theirAddress : "House address…",
      ariaLabel: other ? "Their house address" : "House address",
      showRoute: false,
      allowStops: false,
      originLabel: "House",
      destinationLabel: "House",
      shortcuts: other ? ["use_here"] : ["use_here", "send_to"],
      destinationRequired: false,
      hereCompletes: true,
    };
  }

  if (mode === "shop" && target === "pickup") {
    return {
      role: "store",
      commit: "place",
      title: "Which shop?",
      placeholder: "Grocery, pharmacy…",
      ariaLabel: "Shop",
      showRoute: false,
      allowStops: false,
      originLabel: "Shop",
      destinationLabel: "Deliver to",
      shortcuts: [],
      destinationRequired: false,
      hereCompletes: false,
    };
  }

  if (mode === "shop") {
    return dropoffContract({
      title: "Deliver to?",
      originLabel: "Shop",
      other,
      theirAddress,
    });
  }

  if (mode === "courier") {
    if (target === "pickup") {
      return {
        role: "origin",
        commit: "place",
        title: "Pick up package",
        placeholder: "Pickup address…",
        ariaLabel: "Pickup address",
        showRoute: true,
        allowStops: true,
        originLabel: "Pick up",
        destinationLabel: "Deliver to",
        shortcuts: [],
        destinationRequired: true,
        hereCompletes: false,
      };
    }
    if (stop) {
      return stopContract(stop, {
        originLabel: "Pick up",
        destinationLabel: "Deliver to",
      });
    }
    return dropoffContract({
      title: "Deliver to?",
      originLabel: "Pick up",
      other,
      theirAddress,
    });
  }

  const originLabel = "Pickup";
  const destinationLabel = "Destination";

  if (target === "pickup") {
    return {
      role: "origin",
      commit: "place_or_here",
      title: "Pickup",
      placeholder: "Pickup address…",
      ariaLabel: "Pickup address",
      showRoute: true,
      allowStops: true,
      originLabel,
      destinationLabel,
      shortcuts: [],
      destinationRequired: true,
      hereCompletes: true,
    };
  }

  if (stop) {
    return stopContract(stop, { originLabel, destinationLabel });
  }

  return {
    role: "destination",
    commit: "place",
    title: "Where to?",
    placeholder: "Search an address…",
    ariaLabel: "Destination",
    showRoute: true,
    allowStops: true,
    originLabel,
    destinationLabel,
    shortcuts: [],
    destinationRequired: true,
    hereCompletes: false,
  };
}

function stopTarget(target: SearchTarget): `stop:${number}` | null {
  return target.startsWith("stop:") ? (target as `stop:${number}`) : null;
}

function dropoffContract({
  title,
  originLabel,
  other,
  theirAddress,
}: {
  title: string;
  originLabel: string;
  other: boolean;
  theirAddress: string;
}): SearchInputContract {
  return {
    role: "dropoff",
    commit: "place_or_here",
    title,
    placeholder: other ? theirAddress : "Deliver here…",
    ariaLabel: other ? "Their delivery address" : "Delivery address",
    showRoute: true,
    allowStops: false,
    originLabel,
    destinationLabel: "Deliver to",
    shortcuts: other ? ["use_here"] : ["use_here", "send_to"],
    destinationRequired: true,
    hereCompletes: true,
  };
}

function stopContract(
  target: `stop:${number}`,
  labels: { originLabel: string; destinationLabel: string },
): SearchInputContract {
  const n = Number(target.slice("stop:".length)) + 1;
  return {
    role: "stop",
    commit: "place",
    title: `Stop ${n}`,
    placeholder: `Stop ${n}…`,
    ariaLabel: `Stop ${n}`,
    showRoute: true,
    allowStops: true,
    ...labels,
    shortcuts: [],
    destinationRequired: true,
    hereCompletes: false,
  };
}

export function searchShortcutCopy(
  shortcut: SearchShortcut,
  role: SearchFieldRole,
  audience: SearchAudience,
): { label: string; secondary: string } {
  if (shortcut === "use_here") {
    if (audience === "other") {
      return { label: "Use my location", secondary: "Switch back to here" };
    }
    if (role === "visit") {
      return { label: "This house", secondary: "Helper comes here" };
    }
    return { label: "Deliver to me", secondary: "Use current location" };
  }
  if (role === "visit") {
    return { label: "Someone else's house", secondary: "Send help there" };
  }
  return { label: "Send to someone", secondary: "A different address" };
}
