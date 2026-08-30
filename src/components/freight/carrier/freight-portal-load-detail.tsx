"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ServiceMap } from "@/components/service-app/service-map";
import { Button } from "@/components/ui/button";

import {
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  freight,
  FREIGHT_SEED,
  loadLaneLabel,
  stopPoint,
} from "@/components/freight/freight-api";
import {
  Empty,
  FALLBACK_POINT,
  formatMoney,
  mapAdapter,
  Row,
} from "@/components/freight/freight-parts";

/**
 * Portal load detail — book, assign now/later, reloads, facilities.
 */
export function FreightPortalLoadDetail({ loadId }: { loadId: string }) {
  const router = useRouter();
  const loadQ = freight.getLoad.useQuery(
    { loadId },
    { refetchOnWindowFocus: false },
  );
  const fleet = freight.listFleet.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const returns = freight.suggestReturnLoads.useQuery(
    { loadId, radiusMeters: 160_934 },
    { enabled: Boolean(loadId), refetchOnWindowFocus: false },
  );

  const [assignOpen, setAssignOpen] = useState(false);
  const [driverUserId, setDriverUserId] = useState<string>(
    FREIGHT_SEED.driverUserId,
  );
  const [vehicleId, setVehicleId] = useState<string>(FREIGHT_SEED.vehicleId);
  const [bookedToast, setBookedToast] = useState(false);

  const book = freight.bookLoad.useMutation({
    onSuccess: () => {
      void loadQ.refetch();
      setBookedToast(true);
      setAssignOpen(true);
    },
  });
  const assign = freight.assignDriver.useMutation({
    onSuccess: () => {
      void loadQ.refetch();
      setAssignOpen(false);
      setBookedToast(false);
    },
  });

  const load = loadQ.data;
  const stops = [...(load?.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const pickup = stops.find((s) => s.type === "PICKUP");
  const center = stopPoint(pickup) ?? FALLBACK_POINT;

  useEffect(() => {
    const drivers =
      fleet.data?.members.filter(
        (m) => m.role === "DRIVER" || m.role === "OWNER",
      ) ?? [];
    if (drivers[0] && driverUserId === FREIGHT_SEED.driverUserId) {
      const seed = drivers.find((d) => d.userId === FREIGHT_SEED.driverUserId);
      setDriverUserId(seed?.userId ?? drivers[0]!.userId);
    }
    const vehicles = fleet.data?.vehicles ?? [];
    if (vehicles[0] && vehicleId === FREIGHT_SEED.vehicleId) {
      const match = load
        ? vehicles.find((v) => v.equipmentType === load.equipmentType)
        : vehicles[0];
      if (match) setVehicleId(match.id);
    }
  }, [fleet.data, load, driverUserId, vehicleId]);

  return (
    <div>
      <button
        type="button"
        onClick={() => router.back()}
        className="text-muted-foreground text-[14px] font-medium"
      >
        ← Back
      </button>

      {loadQ.isLoading ? (
        <div className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />
      ) : !load ? (
        <Empty className="mt-6">Load not found.</Empty>
      ) : (
        <div className="mt-4 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
          <div>
            <div className="overflow-hidden rounded-2xl ring-1 ring-border">
              <div className="h-48">
                <ServiceMap
                  adapter={mapAdapter}
                  center={center}
                  mode="route_preview"
                  className="h-full w-full"
                />
              </div>
            </div>

            <h1 className="font-heading mt-5 text-2xl font-semibold tracking-[-0.03em]">
              {loadLaneLabel(load)}
            </h1>
            <p className="text-muted-foreground mt-1 text-[14px]">
              {load.status.replaceAll("_", " ")}
              {load.simulated ? " · Simulated rate" : ""}
            </p>

            <ol className="mt-6 space-y-4 border-l-2 border-border pl-4">
              {stops.map((s) => (
                <li key={s.id} className="relative">
                  <span className="bg-foreground absolute top-1.5 -left-[1.35rem] size-2.5 rounded-full" />
                  <p className="text-[12px] font-medium tracking-wide uppercase text-muted-foreground">
                    {s.type === "PICKUP" ? "Pickup" : "Delivery"}
                  </p>
                  <p className="text-[16px] font-semibold">
                    {s.city}
                    {s.region ? `, ${s.region}` : ""}
                  </p>
                  <p className="text-muted-foreground text-[13px]">{s.address}</p>
                </li>
              ))}
            </ol>

            {returns.data && returns.data.length > 0 ? (
              <section className="mt-8">
                <h2 className="text-[17px] font-semibold">Reloads</h2>
                <ul className="mt-3 space-y-2">
                  {returns.data.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/freight/carrier/loads/${r.id}`}
                        className="bg-secondary block rounded-2xl px-3.5 py-3 text-[14px] font-medium"
                      >
                        {loadLaneLabel(r)} ·{" "}
                        {formatMoney(r.carrierRateMinor, r.currency)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <aside className="bg-card ring-border h-fit space-y-4 rounded-2xl p-5 ring-1 lg:sticky lg:top-24">
            <p className="text-[28px] font-semibold tabular-nums tracking-tight">
              {formatMoney(load.carrierRateMinor, load.currency)}
            </p>
            <dl className="space-y-2 text-[14px]">
              <Row
                label="Rate / mi"
                value={formatRatePerMile(
                  load.carrierRateMinor,
                  load.distanceMeters,
                )}
              />
              <Row label="Distance" value={formatMiles(load.distanceMeters)} />
              <Row
                label="Equipment"
                value={`${EQUIPMENT_LABEL[load.equipmentType]} · ${load.totalWeight.toLocaleString()} lb`}
              />
            </dl>

            {bookedToast ? (
              <div className="bg-accent text-accent-foreground rounded-xl px-3 py-3 text-[13px] leading-relaxed">
                Load booked. Assign a driver now, or do it later from My Loads.
              </div>
            ) : null}

            {load.status === "AVAILABLE" ? (
              <Button
                size="lg"
                className="h-12 w-full"
                disabled={book.isPending}
                onClick={() => book.mutate({ loadId: load.id })}
              >
                {book.isPending ? "Booking…" : "Book load"}
              </Button>
            ) : null}

            {load.status === "BOOKED" || assignOpen ? (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-[15px] font-semibold">Assign driver</p>
                <label className="block text-[13px]">
                  Driver
                  <select
                    className="border-input bg-background mt-1.5 h-11 w-full rounded-xl border px-3 text-[14px]"
                    value={driverUserId}
                    onChange={(e) => setDriverUserId(e.target.value)}
                  >
                    {(
                      fleet.data?.members.filter(
                        (m) => m.role === "DRIVER" || m.role === "OWNER",
                      ) ?? []
                    ).map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.name ?? m.userId.slice(0, 8)} ({m.role})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[13px]">
                  Vehicle
                  <select
                    className="border-input bg-background mt-1.5 h-11 w-full rounded-xl border px-3 text-[14px]"
                    value={vehicleId}
                    onChange={(e) => setVehicleId(e.target.value)}
                  >
                    {(fleet.data?.vehicles ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.unitNumber} · {v.equipmentType}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  className="h-11 w-full"
                  disabled={assign.isPending || !driverUserId || !vehicleId}
                  onClick={() =>
                    assign.mutate({
                      loadId: load.id,
                      driverUserId,
                      vehicleId,
                    })
                  }
                >
                  {assign.isPending ? "Assigning…" : "Assign driver"}
                </Button>
                {bookedToast ? (
                  <Button
                    variant="secondary"
                    className="h-11 w-full"
                    onClick={() => {
                      setBookedToast(false);
                      setAssignOpen(false);
                      router.push("/freight/carrier/loads");
                    }}
                  >
                    Assign later
                  </Button>
                ) : null}
              </div>
            ) : null}

            {load.assignedDriverUserId ? (
              <p className="text-muted-foreground text-[13px]">
                Assigned · {load.assignedDriverUserId.slice(0, 12)}…
              </p>
            ) : null}

            {(book.error || assign.error) && (
              <p role="alert" className="text-destructive text-[13px]">
                {book.error?.message ?? assign.error?.message}
              </p>
            )}

            <Link
              href="/freight/driver"
              className="text-muted-foreground block text-center text-[13px] font-medium underline-offset-2 hover:underline"
            >
              Open freight app
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
