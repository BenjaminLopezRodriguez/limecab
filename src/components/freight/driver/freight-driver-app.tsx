"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Book02Icon,
  Search01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

import { AdaptiveSurface } from "@/components/service-app/adaptive-surface";
import { LocationTrigger } from "@/components/service-app/location-trigger";
import { ServiceMap } from "@/components/service-app/service-map";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { type DriverAction, type EquipmentType } from "@/lib/freight";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

import {
  authBlocked,
  DRIVER_CTA,
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  freight,
  FREIGHT_SEED,
  hitToLoad,
  loadLaneLabel,
  nextStop,
  placeFromLocation,
  primaryDriverAction,
  stopPoint,
  type FreightLoadCard,
  type FreightPlace,
} from "@/components/freight/freight-api";
import {
  Empty,
  EquipmentRow,
  FALLBACK_POINT,
  formatMoney,
  LocSearch,
  mapAdapter,
  type LocField,
} from "@/components/freight/freight-parts";

/**
 * Lime Freight driver / carrier mobile app.
 *
 * Mirrors Uber Freight app IA (not their visuals):
 * Book · My Loads · Drivers · Account
 * Web dispatcher portal stays at /freight/carrier.
 */

type Tab = "book" | "loads" | "drivers" | "account";

const TAB_H = "5.5rem";

export function FreightDriverApp({ loadId }: { loadId?: string }) {
  const [tab, setTab] = useState<Tab>(loadId ? "loads" : "book");

  return (
    <AdaptiveSurface.Root>
      <div
        className="bg-background text-foreground relative flex min-h-dvh flex-col"
        style={{ paddingBottom: TAB_H } as React.CSSProperties}
      >
        <div className="mx-auto w-full max-w-md flex-1 px-5 pt-[max(0.5rem,env(safe-area-inset-top))]">
          {tab === "book" ? <BookScreen /> : null}
          {tab === "loads" ? <MyLoadsScreen focusId={loadId} /> : null}
          {tab === "drivers" ? <DriversScreen /> : null}
          {tab === "account" ? <AccountScreen /> : null}
        </div>
        <FreightDriverTabBar tab={tab} onChange={setTab} />
      </div>
    </AdaptiveSurface.Root>
  );
}

function FreightDriverTabBar({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string; icon: typeof Book02Icon }[] = [
    { id: "book", label: "Book", icon: Search01Icon },
    { id: "loads", label: "My Loads", icon: Book02Icon },
    { id: "drivers", label: "Drivers", icon: UserGroupIcon },
    { id: "account", label: "Account", icon: UserCircleIcon },
  ];
  return (
    <nav
      aria-label="Freight app"
      className="bg-card border-border fixed inset-x-0 bottom-0 z-30 border-t"
      style={{ height: TAB_H }}
    >
      <ul className="mx-auto flex h-full max-w-md items-start justify-around pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onChange(item.id)}
              className={cn(
                "flex min-h-[3.25rem] min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2",
                tab === item.id ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon icon={item.icon} size={22} strokeWidth={tab === item.id ? 2 : 1.5} />
              <span className="text-[11px] font-medium tracking-tight">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ Book */

function BookScreen() {
  const router = useRouter();
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<FreightPlace | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType | "ANY">("ANY");
  const [locOpen, setLocOpen] = useState(false);
  const [results, setResults] = useState<FreightLoadCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState(0);

  const days = useMemo(() => {
    const out: { label: string; date: Date }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() + i);
      out.push({
        label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
        date: d,
      });
    }
    return out;
  }, []);

  const filtered = (results ?? []).filter((l) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return loadLaneLabel(l).toLowerCase().includes(q);
  });

  return (
    <div className="pb-4">
      <h1 className="font-heading text-[22px] font-semibold tracking-[-0.03em]">
        Book
      </h1>

      <div className="scrollbar-none -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {days.map((d, i) => (
          <button
            key={d.label}
            type="button"
            onClick={() => setDayOffset(i)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight",
              dayOffset === i
                ? "bg-foreground text-background"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-2.5">
        <LocationTrigger
          label={origin?.address}
          hint="All loads near you"
          onPress={() => setLocOpen(true)}
        />
        <label className="relative block">
          <span className="sr-only">Filter loads</span>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or lane"
            className="h-12 pl-10"
          />
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <Icon icon={Search01Icon} size={18} />
          </span>
        </label>
      </div>

      <EquipmentRow
        value={equipment === "ANY" ? "DRY_VAN" : equipment}
        onChange={setEquipment}
        allowAny
        anySelected={equipment === "ANY"}
        onAny={() => setEquipment("ANY")}
      />

      <Button
        size="lg"
        className="mt-4 h-12 w-full text-[16px]"
        disabled={!origin || busy}
        onClick={() => {
          if (!origin) return;
          setBusy(true);
          setErr(null);
          void utils.freight.searchLoads
            .fetch({
              originLat: origin.latitude,
              originLng: origin.longitude,
              radiusMeters: 800_000,
              equipmentType: equipment === "ANY" ? undefined : equipment,
              pickupDate: days[dayOffset]?.date,
            })
            .then((hits) => setResults(hits.map(hitToLoad)))
            .catch((e: { message?: string }) => setErr(e.message ?? "Search failed"))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Searching…" : origin ? "Refresh loads" : "Set location"}
      </Button>

      {err ? (
        <p role="alert" className="text-destructive mt-3 text-[14px]">
          {err}
        </p>
      ) : null}

      <ul className="mt-5 space-y-3">
        {!results ? (
          <Empty>Set where you are to see loads near you.</Empty>
        ) : filtered.length === 0 ? (
          <Empty>Nothing matches this lane right now.</Empty>
        ) : (
          filtered.map((load) => (
            <li key={load.id}>
              <BookLoadCard
                load={load}
                onOpen={() => router.push(`/freight/driver/loads/${load.id}`)}
              />
            </li>
          ))
        )}
      </ul>

      <LocSearch
        field={locOpen ? "origin" : null}
        onClose={() => setLocOpen(false)}
        onSelect={(loc) => {
          setOrigin(placeFromLocation(loc));
          setLocOpen(false);
        }}
      />
    </div>
  );
}

function BookLoadCard({
  load,
  onOpen,
}: {
  load: FreightLoadCard;
  onOpen: () => void;
}) {
  const pickup = load.stops?.find((s) => s.type === "PICKUP");
  const drop = load.stops?.find((s) => s.type === "DROPOFF");
  return (
    <button
      type="button"
      onClick={onOpen}
      className="bg-card ring-border w-full rounded-2xl p-4 text-left ring-1"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[22px] font-semibold tabular-nums tracking-tight">
          {formatMoney(load.carrierRateMinor, load.currency)}
        </p>
        <p className="text-muted-foreground text-[13px] tabular-nums">
          {formatRatePerMile(load.carrierRateMinor, load.distanceMeters)}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-[13px] tabular-nums">
        {load.deadheadMeters != null
          ? `${formatMiles(load.deadheadMeters)} deadhead · `
          : ""}
        {formatMiles(load.distanceMeters)}
      </p>
      <p className="mt-3 text-[16px] font-semibold tracking-tight">
        {pickup?.city ?? "Origin"}
        <span className="text-muted-foreground font-normal"> → </span>
        {drop?.city ?? "Destination"}
      </p>
      <p className="text-muted-foreground mt-1 text-[13px]">
        {EQUIPMENT_LABEL[load.equipmentType]} ·{" "}
        {load.totalWeight.toLocaleString()} lb
        {load.simulated ? " · Simulated" : ""}
      </p>
    </button>
  );
}

/* ------------------------------------------------------------------ My Loads */

function MyLoadsScreen({ focusId }: { focusId?: string }) {
  const router = useRouter();
  const [seg, setSeg] = useState<"booked" | "past">("booked");
  const myLoads = freight.myLoads.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const current = freight.driverCurrent.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const active = current.data?.[0] ?? null;
  const next = active ? nextStop(active) : null;
  const mapCenter = stopPoint(next) ?? FALLBACK_POINT;

  const booked = (myLoads.data ?? []).filter(
    (l) => !["COMPLETED", "CANCELED", "REJECTED"].includes(l.status),
  );
  const past = (myLoads.data ?? []).filter((l) =>
    ["COMPLETED", "CANCELED", "REJECTED"].includes(l.status),
  );
  const list = seg === "booked" ? booked : past;

  return (
    <div className="pb-4">
      <h1 className="font-heading text-[22px] font-semibold tracking-[-0.03em]">
        My Loads
      </h1>

      <div className="bg-secondary mt-4 flex rounded-full p-1">
        {(["booked", "past"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeg(s)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13px] font-semibold capitalize",
              seg === s
                ? "bg-foreground text-background"
                : "text-muted-foreground",
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {active && seg === "booked" ? (
        <section className="mt-5">
          <p className="text-muted-foreground text-[12px] font-medium tracking-wide uppercase">
            In progress
          </p>
          <div className="mt-2 overflow-hidden rounded-2xl ring-1 ring-border">
            <div className="h-36">
              <ServiceMap
                adapter={mapAdapter}
                center={mapCenter}
                mode="provider_arrival"
                className="h-full w-full"
              />
            </div>
            <div className="bg-card p-4">
              <p className="text-[12px] font-medium tracking-wide uppercase text-lime">
                {active.status.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-[16px] font-semibold">
                {loadLaneLabel(active)}
              </p>
              <Button
                className="mt-3 h-11 w-full"
                onClick={() =>
                  router.push(`/freight/driver/loads/${active.id}`)
                }
              >
                Open load
              </Button>
            </div>
          </div>
        </section>
      ) : null}

      <ul className="mt-5 space-y-3">
        {myLoads.isLoading ? (
          <div className="bg-muted h-24 animate-pulse rounded-2xl" />
        ) : authBlocked(myLoads.error) ? (
          <Empty>Sign in to see loads.</Empty>
        ) : list.length === 0 ? (
          <Empty>
            {seg === "booked"
              ? "No booked loads. Book from the Book tab."
              : "No past loads yet."}
          </Empty>
        ) : (
          list.map((load) => (
            <li key={load.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/freight/driver/loads/${load.id}`)
                }
                className={cn(
                  "bg-card ring-border w-full rounded-2xl p-4 text-left ring-1",
                  focusId === load.id && "ring-lime ring-2",
                )}
              >
                <p className="text-[16px] font-semibold">
                  {loadLaneLabel(load)}
                </p>
                <p className="text-muted-foreground mt-1 text-[13px]">
                  {load.status.replaceAll("_", " ")} ·{" "}
                  {formatMoney(load.carrierRateMinor, load.currency)}
                </p>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ Drivers */

function DriversScreen() {
  const perspective = freight.perspective.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const memberships = perspective.data?.carrierMemberships ?? [];

  return (
    <div className="pb-4">
      <h1 className="font-heading text-[22px] font-semibold tracking-[-0.03em]">
        Drivers
      </h1>
      <p className="text-muted-foreground mt-1 text-[14px]">
        Fleet roster for your carrier. Full dispatch lives in the carrier
        portal.
      </p>

      {perspective.isLoading ? (
        <div className="bg-muted mt-6 h-24 animate-pulse rounded-2xl" />
      ) : memberships.length === 0 ? (
        <Empty className="mt-6">
          No carrier membership.{" "}
          <Link href="/partner/fleets" className="underline">
            Fleet hub
          </Link>
        </Empty>
      ) : (
        <ul className="mt-6 space-y-3">
          <li className="bg-secondary flex justify-between rounded-2xl px-4 py-3 text-[13px] font-medium">
            <span>Members</span>
            <span>{memberships.length}</span>
          </li>
          {memberships.map((m) => (
            <li
              key={m.id}
              className="bg-card ring-border rounded-2xl p-4 ring-1"
            >
              <p className="text-[16px] font-semibold tracking-tight">
                {m.role === "DRIVER"
                  ? "Driver"
                  : m.role === "DISPATCHER"
                    ? "Dispatcher"
                    : "Owner"}
              </p>
              <p className="text-muted-foreground mt-1 text-[13px]">
                User {m.userId.slice(0, 8)}… · {m.role}
              </p>
              {m.userId === FREIGHT_SEED.driverUserId ? (
                <p className="text-lime mt-2 text-[12px] font-medium">
                  Seed freight driver
                </p>
              ) : null}
            </li>
          ))}
          <li>
            <Link
              href="/partner/fleets/invite"
              className="bg-primary text-primary-foreground flex h-12 items-center justify-center rounded-full text-[15px] font-semibold"
            >
              Invite driver
            </Link>
          </li>
          <li>
            <Link
              href="/freight/carrier"
              className="text-muted-foreground block text-center text-[14px] font-medium underline-offset-2 hover:underline"
            >
              Open carrier portal
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Account */

function AccountScreen() {
  return (
    <div className="pb-4">
      <h1 className="font-heading text-[22px] font-semibold tracking-[-0.03em]">
        Account
      </h1>
      <div className="bg-card ring-border mt-5 rounded-2xl p-4 ring-1">
        <p className="text-[18px] font-semibold tracking-tight">
          Lime Test Carrier
        </p>
        <p className="text-muted-foreground mt-1 text-[13px]">
          DOT — · MC — · Simulated fleet
        </p>
        <dl className="mt-4 space-y-2 text-[14px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Portal</dt>
            <dd>
              <Link href="/freight/carrier" className="font-medium underline">
                Carrier web
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Rides app</dt>
            <dd>
              <Link href="/driver" className="font-medium underline">
                Lime Drive
              </Link>
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Partners</dt>
            <dd>
              <Link href="/partner" className="font-medium underline">
                Gateway
              </Link>
            </dd>
          </div>
        </dl>
      </div>
      <p className="text-muted-foreground mt-6 text-[13px] leading-relaxed">
        Company DOT/MC and lifetime stats will attach when carrier org profile
        ships. This app is for booking and running freight on the road.
      </p>
    </div>
  );
}
