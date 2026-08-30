"use client";

import {
  Airplane01Icon,
  Briefcase01Icon,
  Clock01Icon,
  Home01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";

import Link from "next/link";

import { LocationTrigger } from "@/components/service-app/location-trigger";
import { SavedPlaces } from "@/components/service-app/saved-places";
import { VoiceMicButton } from "@/components/limecab/limecab-voice-banner";
import { Icon } from "@/components/ui/icon";
import { TRAVEL_SPOTS } from "@/lib/limecab/mock";
import type { Location, Place } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";

/** Which glyph a place gets. Product semantics — the kit stays generic. */
function placeIcon(place: Place) {
  if (place.id === "home") return <Icon icon={Home01Icon} size={18} />;
  if (place.id === "work") return <Icon icon={Briefcase01Icon} size={18} />;
  if (place.id === "lax") return <Icon icon={Airplane01Icon} size={18} />;
  if (place.source === "recent") return <Icon icon={Clock01Icon} size={18} />;
  return <Icon icon={Location01Icon} size={18} />;
}

const AIRPORT = TRAVEL_SPOTS.find((place) => place.id === "lax")!;
const CURATED = TRAVEL_SPOTS.filter((place) => place.id !== "lax");

/**
 * The first screen: where the rider usually goes.
 *
 * Pickup lives on the map card (tap to adjust) and later in the ride flow —
 * home does not repeat it as a row above "Where to?".
 */
export function LimeCabHomeScene({
  destination,
  destinationHint = "Where to?",
  title,
  triggerClassName,
  triggerStart,
  hideTagline = false,
  saved,
  recents,
  traveling,
  onTravelingChange,
  onSearch,
  onVoice,
  onChooseLocation,
}: {
  destination: Location | null;
  destinationHint?: string;
  /** Optional scene eyebrow, e.g. "Send a package". */
  title?: string;
  triggerClassName?: string;
  triggerStart?: ReactNode;
  hideTagline?: boolean;
  /** This user's own Home, Work and custom spots. Empty is a real answer. */
  saved: Place[];
  /** Derived from their own trips. Nobody is shown a place they never went. */
  recents: Place[];
  traveling: boolean;
  onTravelingChange: (next: boolean) => void;
  onSearch: (target: "destination") => void;
  onVoice: () => void;
  onChooseLocation: (result: Location) => void;
}) {
  const choose = (place: Place) =>
    onChooseLocation({
      address: place.address,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
    });

  return (
    <div className="flex flex-col gap-4">
      {title ? (
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">{title}</h2>
      ) : traveling ? (
        <h2 className="text-[20px] font-semibold tracking-[-0.02em]">
          In Los Angeles
        </h2>
      ) : null}
      <LocationTrigger
        size="lg"
        hint={destinationHint}
        label={destination?.address}
        onPress={() => onSearch("destination")}
        className={triggerClassName}
        start={triggerStart}
        end={<VoiceMicButton onPress={onVoice} />}
      />
      {hideTagline ? null : (
        <p className="text-muted-foreground -mt-2 px-1 text-xs">
          Ride, send, or get
        </p>
      )}

      {traveling ? (
        <>
          <SavedPlaces
            title="Airport"
            variant="rows"
            places={[AIRPORT]}
            iconFor={placeIcon}
            onSelect={choose}
          />
          <SavedPlaces
            title="Spots nearby"
            variant="rows"
            places={CURATED}
            iconFor={placeIcon}
            onSelect={choose}
          />
        </>
      ) : null}

      {/* Both render nothing when empty — that *is* the empty state. A new
          account is not told it lives in Echo Park. */}
      <SavedPlaces
        title="Saved places"
        places={saved}
        iconFor={placeIcon}
        onSelect={choose}
      />
      <SavedPlaces
        title="Recent"
        variant="rows"
        places={recents}
        iconFor={placeIcon}
        onSelect={choose}
        className="mt-1"
      />

      {/* One quiet line, not a modal: Home still asks exactly one question. */}
      {saved.length === 0 ? (
        <Link
          href="/profile/places"
          className="text-muted-foreground focus-visible:ring-ring rounded-md px-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          Save Home and Work for faster pickup
        </Link>
      ) : null}

      <button
        type="button"
        role="switch"
        aria-checked={traveling}
        aria-label={traveling ? "Stop traveling" : "I'm traveling"}
        onClick={() => onTravelingChange(!traveling)}
        className={cn(
          "text-muted-foreground mt-1 self-start px-1 text-sm",
          "focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        {traveling ? "Not traveling" : "I'm traveling"}
      </button>
    </div>
  );
}
