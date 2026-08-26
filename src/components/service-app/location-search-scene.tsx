"use client";

import { useRef, useState, type ReactNode } from "react";
import { Clock, LocateFixed, MapPin } from "lucide-react";

import { LocationSearch } from "@/components/service-app/location-search";
import {
  TaskScene,
  TaskSceneHeader,
} from "@/components/service-app/task-scene";
import type { GeocodeAdapter } from "@/lib/service-app/geocode-adapter";
import {
  splitAddress,
  type Location,
  type Place,
} from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/**
 * "Where?" — a prepared search environment.
 *
 * Keyboard input, recents, and a current-location affordance in one focused
 * scene. Never an inline field bolted onto home.
 */
export function LocationSearchScene({
  open,
  adapter,
  places = [],
  title = "Where to?",
  route,
  onSelect,
  onDismiss,
  error,
  onError,
}: {
  open: boolean;
  adapter: GeocodeAdapter;
  /** Saved and recent places, shown before the user types anything. */
  places?: Place[];
  title?: string;
  /**
   * The pair of points the search belongs to. Supplied, the input becomes one
   * field of a connected route stack; the other field switches the search to
   * that point. Omitted, the scene is a single free-standing search.
   */
  route?: {
    origin: string;
    destination: string;
    active: "origin" | "destination";
    onSwitch: (field: "origin" | "destination") => void;
  };
  onSelect: (result: Location) => void;
  onDismiss: () => void;
  /** Shown inline under the current-location row. Errors belong to the scene
   *  that caused them, not to a modal stacked on top of it. */
  error?: string | null;
  /** Called with a human-readable message. Feed it back in via `error`. */
  onError?: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);

  const choose = (result: Location) => {
    const address = result.address.trim();
    if (address.length < 4) {
      onError?.("Enter a full address.");
      return;
    }
    onSelect({ ...result, address });
  };

  const useCurrent = () => {
    if (!navigator.geolocation) {
      onError?.("Current location isn't available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          const { latitude, longitude } = position.coords;
          try {
            const resolved = await adapter.reverse?.(latitude, longitude);
            choose(
              resolved ?? { address: "Current location", latitude, longitude },
            );
          } catch {
            choose({ address: "Current location", latitude, longitude });
          } finally {
            setLocating(false);
          }
        })();
      },
      () => {
        setLocating(false);
        onError?.("Location permission is off.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <TaskScene
      open={open}
      title={title}
      description="Search for an address, use your current location, or pick a saved place."
      onDismiss={onDismiss}
      initialFocusRef={inputRef}
    >
      <TaskSceneHeader
        title={title}
        onBack={onDismiss}
        backLabel="Close search"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <LocationSearch
          adapter={adapter}
          layout="scene"
          inputRef={inputRef}
          onSelect={choose}
          placeholder={
            route?.active === "origin"
              ? "Pickup address…"
              : "Search an address…"
          }
          fieldsClassName={
            route
              ? "bg-card ring-border flex flex-col rounded-2xl ring-1"
              : undefined
          }
          inputClassName={
            route
              ? cn(
                  "h-12 rounded-none pr-4 pl-10",
                  // The divider belongs to the first row only; on the last row
                  // the input's own underline would double the card's edge.
                  route.active === "destination" &&
                    "border-transparent focus-visible:border-b-transparent",
                )
              : undefined
          }
          before={
            route ? (
              <>
                <RouteRail />
                {route.active === "destination" ? (
                  <RouteField
                    label="Pickup"
                    value={route.origin}
                    first
                    onPress={() => route.onSwitch("origin")}
                  />
                ) : null}
              </>
            ) : null
          }
          after={
            route?.active === "origin" ? (
              <RouteField
                label="Destination"
                value={route.destination}
                onPress={() => route.onSwitch("destination")}
              />
            ) : null
          }
        />

        <div className="-mx-2 mt-4">
          <AffordanceRow
            icon={<LocateFixed strokeWidth={1.75} />}
            label="Use current location"
            detail={locating ? "Finding…" : undefined}
            disabled={locating}
            onPress={useCurrent}
          />
        </div>

        {error ? (
          <p role="alert" className="text-muted-foreground mt-1 text-sm">
            {error}
          </p>
        ) : null}

        {places.length > 0 ? (
          <>
            <p className="text-muted-foreground mt-5 text-[11px] font-medium tracking-[0.12em] uppercase">
              Places
            </p>
            <ul className="-mx-2 mt-1">
              {places.map((place) => {
                const { line } = splitAddress(place.address);
                return (
                  <li key={place.id}>
                    <AffordanceRow
                      icon={
                        place.source === "recent" ? (
                          <Clock strokeWidth={1.75} />
                        ) : (
                          <MapPin strokeWidth={1.75} />
                        )
                      }
                      label={place.label}
                      secondary={line}
                      detail={place.hint}
                      onPress={() =>
                        choose({
                          address: place.address,
                          latitude: place.latitude ?? undefined,
                          longitude: place.longitude ?? undefined,
                        })
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </div>
    </TaskScene>
  );
}

/**
 * The dot → line → square rail behind the two route fields. Purely a drawing:
 * both fields are exactly one 3rem row, so the glyph positions are fixed.
 */
function RouteRail() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="bg-border absolute top-[30px] bottom-[30px] left-[20.5px] w-px" />
      <span className="bg-primary absolute top-[19px] left-4 size-2.5 rounded-full" />
      <span className="bg-foreground absolute bottom-[19px] left-4 size-2.5 rounded-[3px]" />
    </span>
  );
}

/** The route point that is *not* being searched. Tapping it searches that one. */
function RouteField({
  label,
  value,
  first,
  onPress,
}: {
  label: string;
  value: string;
  first?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={`${label}: ${value || "Not set"}. Search this instead`}
      className={cn(
        "focus-visible:ring-ring relative flex h-12 w-full items-center pr-4 pl-10 text-left text-[15px]",
        "focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
        first ? "border-border rounded-t-2xl border-b" : "rounded-b-2xl",
      )}
    >
      <span className={cn("truncate", !value && "text-muted-foreground")}>
        {value || label}
      </span>
    </button>
  );
}

/** One tappable line of the search scene: glyph, name, address, trailing note. */
function AffordanceRow({
  icon,
  label,
  secondary,
  detail,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  secondary?: string;
  detail?: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-2xl px-2 text-left",
        "hover:bg-accent active:bg-accent disabled:opacity-60",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
      )}
    >
      <span
        aria-hidden="true"
        className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-[18px]"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium tracking-tight">
          {label}
        </span>
        {secondary ? (
          <span className="text-muted-foreground block truncate text-sm">
            {secondary}
          </span>
        ) : null}
      </span>
      {detail ? (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {detail}
        </span>
      ) : null}
    </button>
  );
}
