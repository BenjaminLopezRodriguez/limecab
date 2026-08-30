"use client";

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  PlacesLivePeek,
  PlacesListingsScene,
  PlacesMapExpandControl,
  PlacesPausedHeadline,
  PlacesPausedHome,
  placesAreaLabel,
  placesBookingHint,
  placesListingsSeed,
} from "@/components/partner/partner-places-scenes";
import {
  PLACES_TAB_HEIGHT,
  PartnerPlacesTabBar,
} from "@/components/partner/partner-places-tabs";
import { createMapboxAdapter } from "@/components/service-app/mapbox-adapter";
import { ServiceAppShell } from "@/components/service-app/service-app-shell";
import { ServiceMap } from "@/components/service-app/service-map";
import {
  ServiceSheet,
  SHEET_EXPANDED_SNAP,
} from "@/components/service-app/service-sheet";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import {
  reducePlacesPartnerState,
  placesPartnerQuestion,
  type PlacesPartnerState,
} from "@/lib/partner/places-state";
import type { PlaceListingKind } from "@/lib/partner/places-listings";
import { env } from "@/env";

const mapAdapter = env.NEXT_PUBLIC_MAPBOX_TOKEN
  ? createMapboxAdapter(env.NEXT_PUBLIC_MAPBOX_TOKEN)
  : undefined;

const LA_CENTER = { latitude: 34.0522, longitude: -118.2437 };

type Panel = "home" | "listings" | "bookings";

/**
 * Partner Places desk — same posture as the driver off-duty home:
 * map card, opportunities, one loud primary. Live mode drops to a peek.
 */
export function PartnerPlacesApp({ partnerInitial }: { partnerInitial: string }) {
  const router = useRouter();
  const [state, setState] = useState<PlacesPartnerState>("paused");
  const [panel, setPanel] = useState<Panel>("home");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | PlaceListingKind>("all");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [goLiveBlocked, setGoLiveBlocked] = useState(false);

  const listings = placesListingsSeed;
  const liveCount = listings.filter((row) => row.status === "live").length;
  const question = placesPartnerQuestion(state);

  const points = useMemo<MapPoint[]>(
    () =>
      listings.map((listing) => ({
        latitude: listing.latitude,
        longitude: listing.longitude,
        kind: "poi" as const,
        label: listing.name,
        category: listing.kind === "parking" ? "parking" : "hotel",
      })),
    [listings],
  );

  const setDuty = useCallback((live: boolean) => {
    setBusy(true);
    window.setTimeout(() => {
      setState((current) =>
        reducePlacesPartnerState(current, live ? "go_live" : "go_offline"),
      );
      setBusy(false);
      setPanel("home");
      setGoLiveBlocked(false);
    }, 420);
  }, []);

  const sheetPresentation =
    panel === "listings" || panel === "bookings" ? "expanded" : state === "live" ? "peek" : "launcher";

  return (
    <div
      style={
        {
          "--service-app-chrome": PLACES_TAB_HEIGHT,
          "--nav-pill-clear": "1.5rem",
        } as CSSProperties
      }
    >
      <div className="sr-only" aria-live="polite">
        {`${question.question} ${question.action}.`}
      </div>

      <ServiceAppShell
        layout={mapExpanded ? "task" : "home"}
        mapPressLabel="Open the map"
        onMapPress={() => setMapExpanded(true)}
        header={
          mapExpanded || state === "live" ? undefined : (
            <PlacesPausedHeadline
              onOpenListings={() => setPanel("listings")}
            />
          )
        }
        map={
          <div className="relative size-full">
            <ServiceMap
              adapter={mapAdapter}
              mode="home"
              center={LA_CENTER}
              interactive={mapExpanded}
              zoom={12}
              points={points}
            />
            {!mapExpanded && state === "paused" ? (
              <PlacesMapExpandControl onPress={() => setMapExpanded(true)} />
            ) : null}
            {mapExpanded ? (
              <button
                type="button"
                onClick={() => setMapExpanded(false)}
                className="bg-card ring-border focus-visible:ring-ring absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 z-10 rounded-full px-4 py-2 text-[14px] font-semibold shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                Done
              </button>
            ) : (
              <Link
                href="/partner/places/app/account"
                aria-label="Your account"
                className="bg-card ring-border focus-visible:ring-ring absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10 flex size-11 items-center justify-center rounded-full text-[17px] font-semibold tracking-tight shadow-[0_4px_16px_rgba(26,24,20,0.12)] ring-1 focus-visible:ring-2 focus-visible:outline-none"
              >
                {partnerInitial}
              </Link>
            )}
          </div>
        }
      >
        {sheetPresentation === "launcher" ? (
          <PlacesPausedHome
            areaLabel={placesAreaLabel()}
            liveCount={liveCount}
            bookingHint={placesBookingHint(liveCount)}
            busy={busy}
            error={
              goLiveBlocked
                ? "Publish at least one listing before going live."
                : null
            }
            onGoLive={() => {
              if (liveCount === 0) {
                setGoLiveBlocked(true);
                return;
              }
              setDuty(true);
            }}
            onOpenBookings={() => router.push("/partner/places/app/bookings")}
          />
        ) : (
          <ServiceSheet
            label={
              panel === "listings"
                ? "Your listings"
                : panel === "bookings"
                  ? "Bookings"
                  : "Your Places desk"
            }
            presentation={sheetPresentation}
            onDismiss={
              panel !== "home"
                ? () => setPanel("home")
                : undefined
            }
            onSnapChange={(snap) => {
              if (panel !== "home" && snap < SHEET_EXPANDED_SNAP) {
                setPanel("home");
              }
            }}
          >
            {state === "live" && panel === "home" ? (
              <PlacesLivePeek
                busy={busy}
                onOpenListings={() => setPanel("listings")}
                onGoOffline={() => setDuty(false)}
              />
            ) : null}
            {panel === "listings" ? (
              <PlacesListingsScene
                listings={listings}
                filter={filter}
                onFilter={setFilter}
              />
            ) : null}
          </ServiceSheet>
        )}
      </ServiceAppShell>

      <PartnerPlacesTabBar active="home" />
    </div>
  );
}
