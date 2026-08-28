"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import {
  Clock01Icon,
  Gps01Icon,
  Location01Icon,
  MinusSignIcon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";

import { LocationSearch } from "@/components/service-app/location-search";
import {
  TaskScene,
  TaskSceneHeader,
} from "@/components/service-app/task-scene";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { GeocodeAdapter } from "@/lib/service-app/geocode-adapter";
import {
  MAX_INTERMEDIATE_STOPS,
  type SearchField,
} from "@/lib/service-app/route-draft";
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
  onChooseOnMap,
  error,
  onError,
  trailing,
  banner,
  normalizeQuery,
  renderResults,
  rowAction,
}: {
  open: boolean;
  adapter: GeocodeAdapter;
  /** Saved and recent places, shown before the user types anything. */
  places?: Place[];
  title?: string;
  /**
   * The points the search belongs to. Supplied, the input is one field of a
   * connected route stack (origin, optional stops, destination). Omitted, the
   * scene is a single free-standing search.
   */
  route?: {
    origin: string;
    destination: string;
    stops?: string[];
    active: SearchField;
    onSwitch: (field: SearchField) => void;
    onAddStop?: () => void;
    onRemoveStop?: (index: number) => void;
  };
  onSelect: (result: Location) => void;
  onDismiss: () => void;
  /** Opens the map so the user can drop a pin instead of typing. */
  onChooseOnMap?: () => void;
  /** Shown inline under the current-location row. Errors belong to the scene
   *  that caused them, not to a modal stacked on top of it. */
  error?: string | null;
  /** Called with a human-readable message. Feed it back in via `error`. */
  onError?: (message: string) => void;
  /** Extra control inside the active field (mic). Composed with locate/remove. */
  trailing?: ReactNode;
  /** Listening or fallback copy above the field. Parent stays this scene. */
  banner?: ReactNode;
  normalizeQuery?: (query: string) => string;
  renderResults?: ComponentProps<typeof LocationSearch>["renderResults"];
  /** Trailing control on a suggestion row, e.g. filing the address. */
  rowAction?: ComponentProps<typeof LocationSearch>["rowAction"];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [locating, setLocating] = useState(false);

  const stops = route?.stops ?? [];
  const rows = route
    ? [
        { id: "origin" as const, label: "Pickup", value: route.origin },
        ...stops.map((value, index) => ({
          id: `stop:${index}` as const,
          label: `Stop ${index + 1}`,
          value,
        })),
        {
          id: "destination" as const,
          label: "Destination",
          value: route.destination,
        },
      ]
    : [];
  const activeIndex = rows.findIndex((row) => row.id === route?.active);
  const activeRow = activeIndex >= 0 ? rows[activeIndex] : undefined;
  const canAddStop =
    Boolean(route?.onAddStop) && stops.length < MAX_INTERMEDIATE_STOPS;
  const activeStopIndex =
    route?.active?.startsWith("stop:") === true
      ? Number(route.active.slice("stop:".length))
      : null;

  useEffect(() => {
    inputRef.current?.focus();
  }, [route?.active]);

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
      description="Search for an address, use your current location, set a pin on the map, or pick a saved place."
      onDismiss={onDismiss}
      initialFocusRef={inputRef}
    >
      <TaskSceneHeader
        title={title}
        onBack={onDismiss}
        backLabel="Close search"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {banner}
        <div className="relative">
          <LocationSearch
            key={route?.active ?? "search"}
            adapter={adapter}
            layout="scene"
            inputRef={inputRef}
            value={activeRow?.value ?? ""}
            onSelect={choose}
            normalizeQuery={normalizeQuery}
            renderResults={renderResults}
            rowAction={rowAction}
            placeholder={
              route?.active === "origin"
                ? "Pickup address…"
                : activeStopIndex !== null
                  ? `Stop ${activeStopIndex + 1}…`
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
                    "h-12 rounded-none bg-transparent pl-10 shadow-none md:text-[15px]",
                    "focus-visible:border-transparent focus-visible:ring-0",
                    canAddStop ? "pr-12" : "pr-4",
                    route.active === "destination"
                      ? "border-transparent"
                      : "border-x-0 border-t-0 border-b-border",
                  )
                : undefined
            }
            before={
              route ? (
                <>
                  <RouteRail count={rows.length} />
                  {rows.slice(0, Math.max(0, activeIndex)).map((row, index) => (
                    <RouteField
                      key={row.id}
                      label={row.label}
                      value={row.value}
                      position={index === 0 ? "first" : "middle"}
                      inset={canAddStop}
                      trailing={
                        row.id.startsWith("stop:") && route.onRemoveStop ? (
                          <RemoveStopButton
                            onPress={() =>
                              route.onRemoveStop!(
                                Number(row.id.slice("stop:".length)),
                              )
                            }
                          />
                        ) : null
                      }
                      onPress={() => route.onSwitch(row.id)}
                    />
                  ))}
                </>
              ) : null
            }
            after={
              route
                ? rows.slice(activeIndex + 1).map((row, offset) => {
                    const index = activeIndex + 1 + offset;
                    const last = index === rows.length - 1;
                    return (
                      <RouteField
                        key={row.id}
                        label={row.label}
                        value={row.value}
                        position={last ? "last" : "middle"}
                        inset={canAddStop}
                        trailing={
                          row.id.startsWith("stop:") && route.onRemoveStop ? (
                            <RemoveStopButton
                              onPress={() =>
                                route.onRemoveStop!(
                                  Number(row.id.slice("stop:".length)),
                                )
                              }
                            />
                          ) : null
                        }
                        onPress={() => route.onSwitch(row.id)}
                      />
                    );
                  })
                : null
            }
            end={
              <span className="flex items-center">
                {route?.active === "origin" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={locating}
                    aria-label={
                      locating
                        ? "Finding current location"
                        : "Use current location"
                    }
                    aria-busy={locating}
                    onClick={useCurrent}
                    className="text-muted-foreground"
                  >
                    <Icon icon={Gps01Icon} size={18} />
                  </Button>
                ) : activeStopIndex !== null && route?.onRemoveStop ? (
                  <RemoveStopButton
                    onPress={() => route.onRemoveStop!(activeStopIndex)}
                  />
                ) : null}
                {trailing}
              </span>
            }
          />
          {canAddStop ? (
            <button
              type="button"
              aria-label="Add stop"
              onClick={route?.onAddStop}
              className={cn(
                "bg-background ring-border absolute top-12 right-2 z-20",
                "flex size-8 -translate-y-1/2 items-center justify-center rounded-full ring-1",
                "hover:bg-accent focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              )}
            >
              <Icon icon={PlusSignIcon} size={16} />
            </button>
          ) : null}
        </div>

        {onChooseOnMap ? (
          <div className="-mx-2 mt-4">
            <AffordanceRow
              icon={<Icon icon={Location01Icon} size={18} />}
              label="Set location with pin"
              onPress={onChooseOnMap}
            />
          </div>
        ) : null}

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
                          <Icon icon={Clock01Icon} size={18} />
                        ) : (
                          <Icon icon={Location01Icon} size={18} />
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
 * Dot → (optional numbered stops) → square. Each field is one 3rem row, so
 * glyph positions are a function of count alone.
 */
function RouteRail({ count }: { count: number }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="bg-border absolute top-[30px] bottom-[30px] left-[20.5px] w-px" />
      <span className="bg-lime absolute top-[19px] left-4 size-2.5 rounded-full" />
      {Array.from({ length: Math.max(0, count - 2) }, (_, index) => (
        <span
          key={index}
          className="border-foreground text-foreground absolute left-[14px] flex size-4 items-center justify-center rounded-full border text-[9px] font-medium"
          style={{ top: (index + 1) * 48 + 16 }}
        >
          {index + 1}
        </span>
      ))}
      <span className="bg-foreground absolute bottom-[19px] left-4 size-2.5 rounded-[3px]" />
    </span>
  );
}

function RemoveStopButton({ onPress }: { onPress: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Remove stop"
      onClick={onPress}
      className="text-muted-foreground"
    >
      <Icon icon={MinusSignIcon} size={16} />
    </Button>
  );
}

/** The route point that is *not* being searched. Tapping it searches that one. */
function RouteField({
  label,
  value,
  position,
  inset,
  trailing,
  onPress,
}: {
  label: string;
  value: string;
  position: "first" | "middle" | "last";
  inset?: boolean;
  trailing?: ReactNode;
  onPress: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex h-12 w-full items-center",
        position === "first" && "rounded-t-2xl",
        position === "last" ? "rounded-b-2xl" : "border-border border-b",
      )}
    >
      <button
        type="button"
        onClick={onPress}
        aria-label={`${label}: ${value || "Not set"}. Search this instead`}
        className={cn(
          "focus-visible:ring-ring min-w-0 flex-1 truncate py-0 pl-10 text-left text-[15px]",
          "focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
          inset || trailing ? "pr-2" : "pr-4",
        )}
      >
        <span
          className={cn("block truncate", !value && "text-muted-foreground")}
        >
          {value || label}
        </span>
      </button>
      {trailing}
    </div>
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
