"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ServiceMap } from "@/components/service-app/service-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DriverAction } from "@/lib/freight";

import {
  DRIVER_CTA,
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  freight,
  FREIGHT_SEED,
  loadLaneLabel,
  nextStop,
  primaryDriverAction,
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
 * Load detail — multistop timeline, economics, facility notes, book / run.
 * Inspired by Uber Freight app load + facility screens (ops model only).
 */
export function FreightDriverLoadDetail({ loadId }: { loadId: string }) {
  const router = useRouter();
  const loadQ = freight.getLoad.useQuery(
    { loadId },
    { refetchOnWindowFocus: false },
  );
  const returns = freight.suggestReturnLoads.useQuery(
    { loadId, radiusMeters: 160_934 },
    { enabled: Boolean(loadId), refetchOnWindowFocus: false },
  );
  const book = freight.bookLoad.useMutation({
    onSuccess: () => void loadQ.refetch(),
  });
  const assign = freight.assignDriver.useMutation({
    onSuccess: () => void loadQ.refetch(),
  });
  const advance = freight.advance.useMutation({
    onSuccess: () => void loadQ.refetch(),
  });
  const submitPod = freight.submitPod.useMutation({
    onSuccess: () => void loadQ.refetch(),
  });

  const [driverUserId, setDriverUserId] = useState<string>(
    FREIGHT_SEED.driverUserId,
  );
  const [vehicleId, setVehicleId] = useState<string>(FREIGHT_SEED.vehicleId);

  const load = loadQ.data;
  const stops = [...(load?.stops ?? [])].sort((a, b) => a.sequence - b.sequence);
  const pickup = stops.find((s) => s.type === "PICKUP");
  const drop = stops.find((s) => s.type === "DROPOFF");
  const center =
    stopPoint(nextStop(load ?? { stops, status: "AVAILABLE" })) ??
    stopPoint(pickup) ??
    FALLBACK_POINT;
  const action = load ? primaryDriverAction(load.status) : null;
  const isAssignedDriver =
    load?.assignedDriverUserId != null &&
    load.status !== "AVAILABLE" &&
    load.status !== "QUOTED" &&
    load.status !== "DRAFT";

  return (
    <div className="mx-auto max-w-md px-5 pb-[calc(5.5rem+1rem)] pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => router.push("/freight/driver")}
        className="text-muted-foreground text-[14px] font-medium"
      >
        ← Back
      </button>

      {loadQ.isLoading ? (
        <div className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />
      ) : !load ? (
        <Empty className="mt-6">Load not found.</Empty>
      ) : (
        <>
          <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-border">
            <div className="h-40">
              <ServiceMap
                adapter={mapAdapter}
                center={center}
                mode="route_preview"
                className="h-full w-full"
              />
            </div>
          </div>

          <p className="mt-5 text-[28px] font-semibold tabular-nums tracking-tight">
            {formatMoney(load.carrierRateMinor, load.currency)}
          </p>
          <p className="text-muted-foreground text-[14px]">
            {stops.filter((s) => s.type === "PICKUP").length} pickup
            {stops.filter((s) => s.type === "PICKUP").length === 1 ? "" : "s"} ·{" "}
            {stops.filter((s) => s.type === "DROPOFF").length} delivery
          </p>

          <ol className="mt-6 space-y-4 border-l-2 border-border pl-4">
            {stops.map((s) => (
              <li key={s.id} className="relative">
                <span className="bg-foreground absolute top-1.5 -left-[1.35rem] size-2.5 rounded-full" />
                <p className="text-[12px] font-medium tracking-wide uppercase text-muted-foreground">
                  {s.type === "PICKUP" ? "Pickup" : "Delivery"}
                </p>
                <p className="text-[16px] font-semibold tracking-tight">
                  {s.city}
                  {s.region ? `, ${s.region}` : ""}
                </p>
                <p className="text-muted-foreground text-[13px]">{s.address}</p>
                {s.appointmentStart ? (
                  <p className="text-muted-foreground mt-0.5 text-[12px]">
                    Appt{" "}
                    {new Date(s.appointmentStart).toLocaleString(undefined, {
                      weekday: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}
                {s.instructions ? (
                  <p className="bg-secondary mt-2 rounded-xl px-3 py-2 text-[13px] leading-snug">
                    {s.instructions}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>

          <dl className="mt-6 space-y-2.5 text-[15px]">
            <Row
              label="Distance"
              value={formatMiles(load.distanceMeters)}
            />
            <Row
              label="Rate / mi"
              value={formatRatePerMile(
                load.carrierRateMinor,
                load.distanceMeters,
              )}
            />
            <Row
              label="Equipment"
              value={`${EQUIPMENT_LABEL[load.equipmentType]} · ${load.totalWeight.toLocaleString()} ${load.weightUnit}`}
            />
            <Row label="Status" value={load.status.replaceAll("_", " ")} />
            <Row label="Load ID" value={load.id.slice(0, 8)} />
            {load.simulated ? <Row label="Pricing" value="Simulated" /> : null}
          </dl>

          {/* Facility cards — amenities foundation */}
          {pickup ? (
            <FacilityBlock
              title="Pickup facility"
              city={pickup.city}
              region={pickup.region}
              address={pickup.address}
              instructions={pickup.instructions}
            />
          ) : null}
          {drop ? (
            <FacilityBlock
              title="Delivery facility"
              city={drop.city}
              region={drop.region}
              address={drop.address}
              instructions={drop.instructions}
            />
          ) : null}

          {returns.data && returns.data.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-[17px] font-semibold tracking-tight">
                Reloads
              </h2>
              <p className="text-muted-foreground mt-0.5 text-[13px]">
                Next loads near delivery
              </p>
              <ul className="mt-3 space-y-2">
                {returns.data.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/freight/driver/loads/${r.id}`}
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

          <div className="mt-8 space-y-3">
            {load.status === "AVAILABLE" ? (
              <Button
                size="lg"
                className="h-14 w-full text-[17px]"
                disabled={book.isPending}
                onClick={() => book.mutate({ loadId: load.id })}
              >
                {book.isPending ? "Booking…" : "Book load"}
              </Button>
            ) : null}

            {load.status === "BOOKED" ? (
              <div className="space-y-3">
                <p className="text-[15px] font-semibold">Assign driver</p>
                <Input
                  value={driverUserId}
                  onChange={(e) => setDriverUserId(e.target.value)}
                  placeholder="Driver user id"
                  className="h-12"
                />
                <Input
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  placeholder="Vehicle id"
                  className="h-12"
                />
                <Button
                  size="lg"
                  className="h-14 w-full text-[17px]"
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
              </div>
            ) : null}

            {isAssignedDriver && load.assignedDriverUserId ? (
              <div className="bg-card ring-border rounded-2xl p-4 ring-1">
                <p className="text-muted-foreground text-[12px] font-medium uppercase">
                  Driver
                </p>
                <p className="mt-1 text-[15px] font-semibold">
                  {load.assignedDriverUserId.slice(0, 12)}…
                </p>
                {load.status === "BOOKED" || load.status === "DRIVER_ASSIGNED" ? (
                  <p className="text-muted-foreground mt-1 text-[13px]">
                    Change via assign above while BOOKED.
                  </p>
                ) : null}
              </div>
            ) : null}

            {action === "submit_pod" || load.status === "DELIVERED" ? (
              <Button
                size="lg"
                className="h-14 w-full text-[17px]"
                disabled={submitPod.isPending}
                onClick={() =>
                  submitPod.mutate({
                    loadId: load.id,
                    storageReference: `mock://pod/${load.id}`,
                  })
                }
              >
                {submitPod.isPending ? "Submitting…" : "Upload POD"}
              </Button>
            ) : action &&
              load.assignedDriverUserId &&
              load.status !== "AVAILABLE" &&
              load.status !== "BOOKED" ? (
              <Button
                size="lg"
                className="h-14 w-full text-[17px]"
                disabled={advance.isPending}
                onClick={() =>
                  advance.mutate({
                    loadId: load.id,
                    action: action as DriverAction,
                  })
                }
              >
                {advance.isPending
                  ? "Updating…"
                  : (DRIVER_CTA[action] ?? "Advance")}
              </Button>
            ) : null}

            {(book.error || assign.error || advance.error || submitPod.error) && (
              <p role="alert" className="text-destructive text-[14px]">
                {book.error?.message ??
                  assign.error?.message ??
                  advance.error?.message ??
                  submitPod.error?.message}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FacilityBlock({
  title,
  city,
  region,
  address,
  instructions,
}: {
  title: string;
  city: string;
  region: string;
  address: string;
  instructions?: string | null;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <div className="bg-card ring-border mt-2 rounded-2xl p-4 ring-1">
        <p className="text-[16px] font-semibold">
          {city}
          {region ? `, ${region}` : ""}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[13px]">{address}</p>
        <p className="text-muted-foreground mt-2 text-[12px]">
          Rating — · Amenities: parking / restroom / scale (later)
        </p>
        {instructions ? (
          <div className="mt-3">
            <p className="text-[12px] font-medium tracking-wide uppercase text-muted-foreground">
              Shipper notes
            </p>
            <p className="mt-1 text-[14px] leading-snug">{instructions}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
