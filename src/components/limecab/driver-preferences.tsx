"use client";

import { useState } from "react";
import {
  CheckmarkCircle02Icon,
  DeliveryTruck01Icon,
  Location01Icon,
  Car01Icon,
  Home01Icon,
  FavouriteIcon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import {
  CareRulesSurface,
  HelpExplainSurface,
} from "@/components/limecab/driver-help-optin";
import { ProfileNote, ProfileSection } from "@/components/limecab/profile";
import { SettingSwitch } from "@/components/limecab/profile-settings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { CARE_RULES_VERSION } from "@/lib/limecab/help";
import { DRIVER_PREFERENCES } from "@/lib/limecab/mock";
import { splitAddress, type Place } from "@/lib/service-app/services";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

/**
 * Driving preferences — which offers this driver wants to be shown.
 *
 * Uber's order, LimeCab's actual filters: a banner that says whether anything
 * is being filtered out, the services, then the trip filters. Every control
 * here reaches `inbox.open`; the one that does not says so in a note rather
 * than pretending. There are no cash trips, so there is no row for them —
 * Shop is a courier job and shares that card.
 *
 * Help is the exception to "a service is a switch": it is consent to enter
 * somebody's home, so its card opens an explainer and the flag flips on the
 * far side of it.
 */
export function DriverPreferences(props: {
  driver: {
    acceptXl: boolean;
    longTrips: boolean;
    courierJobs: boolean;
    helpJobs: boolean;
    careJobs: boolean;
    careRulesVersion: string | null;
    headingAddress: string | null;
  };
  places: Place[];
}) {
  // This page is not inside the duty session's surface manager, so it brings
  // its own root: an interruption still has to suspend and restore a parent.
  return (
    <AdaptiveSurface.Root>
      <DriverPreferencesBody {...props} />
    </AdaptiveSurface.Root>
  );
}

function DriverPreferencesBody({
  driver,
  places,
}: {
  driver: {
    acceptXl: boolean;
    longTrips: boolean;
    courierJobs: boolean;
    helpJobs: boolean;
    careJobs: boolean;
    careRulesVersion: string | null;
    headingAddress: string | null;
  };
  places: Place[];
}) {
  const utils = api.useUtils();
  const refresh = () => {
    void utils.driver.me.invalidate();
    void utils.driver.inbox.invalidate();
  };
  const setPreferences = api.driver.setPreferences.useMutation({
    onSettled: refresh,
  });
  const setHeading = api.driver.setHeading.useMutation({ onSettled: refresh });

  // Optimistic locally so a switch never lags a thumb; the server is the
  // truth on the next inbox read.
  const [prefs, setPrefs] = useState({
    acceptXl: driver.acceptXl,
    longTrips: driver.longTrips,
    courierJobs: driver.courierJobs,
    helpJobs: driver.helpJobs,
    rides: true,
  });
  /** The explainer, open. App data about this page, not a second screen. */
  const [explainHelp, setExplainHelp] = useState(false);
  const [careRules, setCareRules] = useState(false);
  const [careError, setCareError] = useState<string | null>(null);
  /** Care is current only against *these* rules; the server decides. */
  const [careOn, setCareOn] = useState(
    driver.careJobs && driver.careRulesVersion === CARE_RULES_VERSION,
  );
  const acknowledgeCare = api.driver.acknowledgeCareRules.useMutation({
    onSettled: refresh,
  });
  const [heading, setLocalHeading] = useState(driver.headingAddress);
  const [headingOpen, setHeadingOpen] = useState(false);
  // The switches are uncontrolled, so Reset remounts them rather than growing
  // a second copy of their state.
  const [resetKey, setResetKey] = useState(0);

  const set = (patch: Partial<typeof prefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    // `rides` is not a column: rides are the product, not a filter.
    setPreferences.mutate({
      acceptXl: next.acceptXl,
      longTrips: next.longTrips,
      courierJobs: next.courierJobs,
      helpJobs: next.helpJobs,
    });
  };

  /**
   * Help on is only ever reached through the explainer. Off is immediate and
   * clears the acknowledgement server-side, so turning it back on asks again.
   */
  const toggleHelp = () => {
    if (prefs.helpJobs) {
      // Care lives inside Help, and the server clears it with the flag.
      setCareOn(false);
      set({ helpJobs: false });
      return;
    }
    setExplainHelp(true);
  };

  /** Care on is only ever reached by walking the rules, one at a time. */
  const toggleCare = () => {
    if (!prefs.helpJobs) return;
    setCareError(null);
    if (careOn) {
      setCareOn(false);
      setPreferences.mutate({ careJobs: false });
      return;
    }
    setCareRules(true);
  };

  const chooseHeading = (place: {
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  }) => {
    setLocalHeading(place.address);
    setHeadingOpen(false);
    setHeading.mutate(place);
  };

  const filters = [
    heading ? "you’re heading somewhere" : null,
    prefs.courierJobs ? null : "courier is off",
    prefs.helpJobs ? null : "Help is off",
    careOn ? null : "Care is off",
    prefs.acceptXl ? null : "Lime XL is off",
    prefs.longTrips ? null : "longer trips are off",
  ].filter(Boolean);

  return (
    <>
      <p
        className={cn(
          "rounded-2xl px-4 py-3.5 text-[15px] leading-snug font-medium tracking-tight",
          filters.length ? "bg-muted" : "bg-lime/20",
        )}
      >
        {filters.length
          ? `Filtered — ${filters[0]}.`
          : "Open to all trips"}
      </p>

      <h2 className="mt-7 text-[21px] font-semibold tracking-[-0.02em]">
        Services
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ServiceCard
          label="Ride"
          icon={Car01Icon}
          selected={prefs.rides}
          // Rides are the product. Turning them off would leave a driver on
          // duty with nothing to be offered, so this card states the fact.
          locked
          onToggle={() => undefined}
        />
        <ServiceCard
          label="Courier"
          icon={DeliveryTruck01Icon}
          selected={prefs.courierJobs}
          onToggle={() => set({ courierJobs: !prefs.courierJobs })}
        />
        <ServiceCard
          label="Help"
          icon={Home01Icon}
          selected={prefs.helpJobs}
          onToggle={toggleHelp}
        />
        <ServiceCard
          label="Care"
          icon={FavouriteIcon}
          selected={careOn}
          // Care is Help with rules on top, so it cannot be reached first.
          locked={!prefs.helpJobs}
          note={prefs.helpJobs ? undefined : "Enable Help first"}
          onToggle={toggleCare}
        />
        {/* TODO: wire freight.driverCurrent into /driver inbox when
            freightCarrierMembers (or invite accept) unlocks freightJobs. */}
        <ServiceCard
          label="Freight"
          icon={DeliveryTruck01Icon}
          selected={false}
          locked
          note="Join a fleet to unlock"
          onToggle={() => undefined}
        />
      </div>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Help is a scheduled visit to someone’s home — light household tasks,
        not a ride. Care is companionship and daily living, and has its own
        rules. Courier covers Shop jobs too.{" "}
        <a
          href="/partner/fleets/join"
          className="text-foreground font-medium underline-offset-2 hover:underline"
        >
          Join a fleet
        </a>{" "}
        to qualify for freight loads in this same Drive app.
      </p>

      <HelpExplainSurface
        open={explainHelp}
        busy={setPreferences.isPending}
        onEnable={() => {
          set({ helpJobs: true });
          setExplainHelp(false);
        }}
        onDismiss={() => setExplainHelp(false)}
      />

      <CareRulesSurface
        open={careRules}
        busy={acknowledgeCare.isPending}
        error={careError}
        onEnable={(input) =>
          acknowledgeCare.mutate(input, {
            onSuccess: () => {
              setCareOn(true);
              setCareRules(false);
              setCareError(null);
            },
            onError: (reason) => setCareError(reason.message),
          })
        }
        onDismiss={() => {
          setCareRules(false);
          setCareError(null);
        }}
      />

      <h2 className="mt-7 text-[21px] font-semibold tracking-[-0.02em]">
        Trip filters
      </h2>
      <ProfileSection key={resetKey} tone="driver" className="!mt-3">
        <button
          type="button"
          onClick={() => setHeadingOpen((open) => !open)}
          aria-expanded={headingOpen}
          className="focus-visible:ring-ring active:bg-accent flex min-h-14 w-full items-center gap-3 px-4 text-left focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none"
        >
          <Icon icon={Location01Icon} size={18} aria-hidden="true" />
          <span className="shrink-0 text-[15px] font-medium tracking-tight">
            Heading
          </span>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm">
            {heading ? splitAddress(heading).line : "Anywhere"}
          </span>
        </button>
        {headingOpen ? (
          <div className="flex flex-col gap-2 px-4 pt-1 pb-3">
            {[
              {
                id: "anywhere",
                label: "Anywhere",
                address: null,
                latitude: null,
                longitude: null,
              },
              ...places.map((place) => ({
                id: place.id,
                label: place.label,
                address: place.address,
                latitude: place.latitude ?? null,
                longitude: place.longitude ?? null,
              })),
            ].map((option) => (
              <Button
                key={option.id}
                variant={
                  (option.address ?? null) === heading ? "default" : "outline"
                }
                className="h-12 w-full justify-start text-[15px]"
                disabled={setHeading.isPending}
                onClick={() =>
                  chooseHeading({
                    address: option.address,
                    latitude: option.latitude,
                    longitude: option.longitude,
                  })
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : null}
        <SettingSwitch
          label="Lime XL"
          description="Offers for six-seaters when your car qualifies."
          defaultChecked={prefs.acceptXl}
          onChange={(checked) => set({ acceptXl: checked })}
        />
        <SettingSwitch
          label="Longer trips"
          description="Airport and out-of-area jobs, not just neighborhood hops."
          defaultChecked={prefs.longTrips}
          onChange={(checked) => set({ longTrips: checked })}
        />
        <SettingSwitch
          label="Navigation voice"
          description="Spoken turn-by-turn while a job is active."
          defaultChecked={DRIVER_PREFERENCES.navigationVoice}
        />
      </ProfileSection>

      <div className="mt-6 flex justify-center">
        <Button
          variant="secondary"
          className="h-12 px-8"
          disabled={setPreferences.isPending || setHeading.isPending}
          onClick={() => {
            // Reset restores the *ride* defaults. Help stays where it is:
            // consent is not a preference a Reset button can grant.
            set({ acceptXl: true, longTrips: true, courierJobs: true });
            setResetKey((n) => n + 1);
            if (heading) {
              chooseHeading({ address: null, latitude: null, longitude: null });
            }
          }}
        >
          Reset
        </Button>
      </div>

      <ProfileNote>
        Navigation voice is display-only in this build — there is no
        turn-by-turn to speak yet. Everything above it changes which offers
        reach you while you’re on duty.
      </ProfileNote>
    </>
  );
}

function ServiceCard({
  label,
  icon,
  selected,
  locked = false,
  note,
  onToggle,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["icon"];
  selected: boolean;
  locked?: boolean;
  /** Why this card cannot be picked. States the fact instead of going grey. */
  note?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={selected}
      aria-disabled={locked || undefined}
      onClick={locked ? undefined : onToggle}
      className={cn(
        "focus-visible:ring-ring relative flex h-32 flex-col items-start justify-end rounded-2xl p-4 text-left ring-1 focus-visible:ring-2 focus-visible:outline-none",
        selected ? "ring-foreground ring-2" : "ring-border",
        locked && "cursor-default",
      )}
    >
      {selected ? (
        <Icon
          icon={CheckmarkCircle02Icon}
          size={22}
          className="text-lime absolute top-3 right-3"
          aria-hidden="true"
        />
      ) : null}
      <Icon icon={icon} size={26} aria-hidden="true" />
      <span className="mt-2 text-[17px] font-semibold tracking-tight">
        {label}
      </span>
      {note ? (
        <span className="text-muted-foreground mt-0.5 text-sm">{note}</span>
      ) : null}
    </button>
  );
}
