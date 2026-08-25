"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  Clock,
  Grid2x2,
  House,
  MapPin,
  Star,
  User,
} from "lucide-react";

import { LimeCabApp } from "@/components/limecab/limecab-app";
import { ServiceGrid } from "@/components/service-app/service-grid";
import { formatMoney } from "@/lib/service-app/services";
import type { ServiceAppState } from "@/lib/service-app/state";
import {
  LIMECAB_SERVICES,
  PAYMENT_METHODS,
  RIDER,
  SAVED_PLACES,
  TRIP_HISTORY,
} from "@/lib/limecab/mock";
import { cn } from "@/lib/utils";

/**
 * The app frame: a greeting, the tab the rider is in, and the tab bar.
 *
 * The ride flow stays mounted across tab changes — leaving Activity and coming
 * back must not reset a destination the rider already chose. The tab bar hides
 * itself once the rider is inside a ride task, because a request in progress
 * owns the screen; that is the only thing the ride flow tells the shell.
 */

const TABS = [
  { id: "home", label: "Home", icon: House },
  { id: "services", label: "Services", icon: Grid2x2 },
  { id: "activity", label: "Activity", icon: Clock },
  { id: "profile", label: "Profile", icon: User },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function LimeCabShell() {
  const [tab, setTab] = useState<TabId>("home");
  const [scene, setScene] = useState<ServiceAppState>("home");

  // Stable identity: the ride flow reports its scene from an effect.
  const onSceneChange = useCallback((next: ServiceAppState) => {
    setScene(next);
  }, []);

  const inTask = scene !== "home";
  const showChrome = tab !== "home" || !inTask;

  return (
    <main
      className="bg-background text-foreground"
      style={
        {
          // The shell's own chrome, so the kit sizes the canvas correctly.
          "--service-app-chrome": showChrome ? "8rem" : "0rem",
        } as React.CSSProperties
      }
    >
      {showChrome ? (
        <header className="flex h-[3.75rem] items-center justify-between px-5 md:px-6">
          <p className="text-[19px] font-semibold tracking-[-0.03em]">
            Hello, <span className="text-primary">{RIDER.name}</span>
          </p>
          <span className="text-muted-foreground text-sm tabular-nums">
            {RIDER.rating.toFixed(2)} ★
          </span>
        </header>
      ) : null}

      {/* Never unmounted: a half-chosen ride survives a trip to Activity. */}
      <div className={cn(tab !== "home" && "hidden")}>
        <LimeCabApp onSceneChange={onSceneChange} />
      </div>

      {tab === "services" ? <ServicesTab onPickRide={() => setTab("home")} /> : null}
      {tab === "activity" ? <ActivityTab /> : null}
      {tab === "profile" ? <ProfileTab /> : null}

      {showChrome ? <TabBar tab={tab} onChange={setTab} /> : null}
    </main>
  );
}

function TabBar({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (next: TabId) => void;
}) {
  return (
    <nav
      aria-label="Sections"
      className="bg-background border-border fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] md:mx-auto md:max-w-md md:rounded-t-3xl md:border-x"
    >
      <ul className="grid grid-cols-4">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = id === tab;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring flex min-h-[4.25rem] w-full flex-col items-center justify-center gap-1 focus-visible:ring-2 focus-visible:-outline-offset-2 focus-visible:outline-none",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2 : 1.6}
                  aria-hidden="true"
                />
                <span className="text-[11px] tracking-tight">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Tabs other than Home are plain scrolling pages, not task surfaces. */
function TabPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-8rem)] px-5 pb-6 md:mx-auto md:max-w-2xl md:px-6">
      <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ServicesTab({ onPickRide }: { onPickRide: () => void }) {
  return (
    <TabPage title="Services">
      <ServiceGrid
        services={LIMECAB_SERVICES}
        onSelect={(service) => {
          if (service.status === "available") onPickRide();
        }}
        unavailableLabel="Not in your city yet"
      />
      <p className="text-muted-foreground mt-5 text-sm leading-relaxed">
        Only rides are live. The rest are listed so you can see where LimeCab is
        going, not to take your booking.
      </p>
    </TabPage>
  );
}

function ActivityTab() {
  return (
    <TabPage title="Activity">
      <ul className="divide-border ring-border divide-y rounded-2xl ring-1">
        {TRIP_HISTORY.map((trip) => (
          <li
            key={trip.id}
            className="flex items-start gap-3 px-4 py-3.5 first:rounded-t-2xl last:rounded-b-2xl"
          >
            <MapPin
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium tracking-tight">
                {trip.destination}
              </p>
              <p className="text-muted-foreground truncate text-sm">
                {trip.when} · {trip.productName} with {trip.driverName}
              </p>
            </div>
            <p className="shrink-0 text-[15px] tabular-nums">
              {formatMoney(trip.totalCents)}
            </p>
          </li>
        ))}
      </ul>
    </TabPage>
  );
}

function ProfileTab() {
  return (
    <TabPage title="Profile">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="bg-accent text-accent-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-[20px] font-semibold"
        >
          {RIDER.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium tracking-tight">
            {RIDER.fullName}
          </p>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <Star className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
            <span className="tabular-nums">{RIDER.rating.toFixed(2)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{RIDER.ridesTaken} rides</span>
          </p>
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-sm">{RIDER.since}</p>

      <ProfileSection title="Payment">
        {PAYMENT_METHODS.map((method) => (
          <Row key={method.id} label={method.label} value={method.detail} />
        ))}
      </ProfileSection>

      <ProfileSection title="Saved places">
        {SAVED_PLACES.filter((place) => place.source === "saved").map((place) => (
          <Row key={place.id} label={place.label} value={place.address} />
        ))}
      </ProfileSection>
    </TabPage>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-7">
      <h2 className="text-muted-foreground text-xs tracking-wide uppercase">
        {title}
      </h2>
      <div className="divide-border ring-border mt-2 divide-y rounded-2xl ring-1">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4">
      <span className="shrink-0 text-[15px] font-medium tracking-tight">
        {label}
      </span>
      <span className="text-muted-foreground min-w-0 flex-1 truncate text-right text-sm">
        {value}
      </span>
    </div>
  );
}
