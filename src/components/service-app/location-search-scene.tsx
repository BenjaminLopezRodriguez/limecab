"use client";

import { useRef, useState } from "react";

import { LocationSearch } from "@/components/service-app/location-search";
import {
  TaskScene,
  TaskSceneHeader,
} from "@/components/service-app/task-scene";
import type { GeocodeAdapter } from "@/lib/service-app/geocode-adapter";
import { splitAddress, type Location, type Place } from "@/lib/service-app/services";

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
        />

        <button
          type="button"
          onClick={useCurrent}
          disabled={locating}
          className="hover:bg-accent mt-5 flex min-h-12 w-full items-center justify-between rounded-xl px-3 text-left text-[15px] disabled:opacity-60"
        >
          Current location
          <span className="text-muted-foreground text-sm">
            {locating ? "Finding…" : "Use"}
          </span>
        </button>

        {error ? (
          <p role="alert" className="text-muted-foreground mt-2 px-3 text-sm">
            {error}
          </p>
        ) : null}

        {places.length > 0 ? (
          <>
            <p className="text-muted-foreground mt-6 px-3 text-xs tracking-wide uppercase">
              Places
            </p>
            <ul className="mt-1">
              {places.map((place) => {
                const { line, locality } = splitAddress(place.address);
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() =>
                        choose({
                          address: place.address,
                          latitude: place.latitude ?? undefined,
                          longitude: place.longitude ?? undefined,
                        })
                      }
                      className="hover:bg-accent flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px]">
                          {place.label}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {locality || line}
                        </span>
                      </span>
                      {place.hint ? (
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {place.hint}
                        </span>
                      ) : null}
                    </button>
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
