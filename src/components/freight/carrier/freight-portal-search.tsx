"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { LocationTrigger } from "@/components/service-app/location-trigger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type EquipmentType } from "@/lib/freight";
import { api } from "@/trpc/react";

import {
  EQUIPMENT_LABEL,
  formatMiles,
  formatRatePerMile,
  freight,
  hitToLoad,
  loadLaneLabel,
  placeFromLocation,
  type FreightLoadCard,
  type FreightPlace,
} from "@/components/freight/freight-api";
import {
  Empty,
  EquipmentRow,
  formatMoneyOrDash,
  LocSearch,
  type LocField,
} from "@/components/freight/freight-parts";

/**
 * Portal Search tab — find loads, open detail, save lane.
 */
export function FreightPortalSearch() {
  const router = useRouter();
  const utils = api.useUtils();
  const [origin, setOrigin] = useState<FreightPlace | null>(null);
  const [dest, setDest] = useState<FreightPlace | null>(null);
  const [equipment, setEquipment] = useState<EquipmentType | "ANY">("ANY");
  const [date, setDate] = useState("");
  const [locField, setLocField] = useState<LocField | null>(null);
  const [results, setResults] = useState<FreightLoadCard[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const saveLane = freight.saveLane.useMutation({
    onSuccess: () => {
      setSavedMsg("Lane saved. See Saved Lanes.");
      void utils.freight.listSavedLanes.invalidate();
    },
  });

  const runSearch = () => {
    if (!origin) return;
    setBusy(true);
    setErr(null);
    setSavedMsg(null);
    void utils.freight.searchLoads
      .fetch({
        originLat: origin.latitude,
        originLng: origin.longitude,
        radiusMeters: 800_000,
        destLat: dest?.latitude,
        destLng: dest?.longitude,
        equipmentType: equipment === "ANY" ? undefined : equipment,
        pickupDate: date ? new Date(`${date}T12:00:00`) : undefined,
      })
      .then((hits) => setResults(hits.map(hitToLoad)))
      .catch((e: { message?: string }) => setErr(e.message ?? "Search failed"))
      .finally(() => setBusy(false));
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        Search
      </h1>
      <p className="text-muted-foreground mt-1 text-[15px]">
        Find available loads. Save a lane for recurring discovery.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <aside className="bg-card ring-border space-y-3 rounded-2xl p-4 ring-1">
          <LocationTrigger
            label={origin?.address}
            hint="Origin *"
            onPress={() => setLocField("origin")}
          />
          <LocationTrigger
            label={dest?.address}
            hint="Destination"
            onPress={() => setLocField("dest")}
          />
          <EquipmentRow
            value={equipment === "ANY" ? "DRY_VAN" : equipment}
            onChange={setEquipment}
            allowAny
            anySelected={equipment === "ANY"}
            onAny={() => setEquipment("ANY")}
          />
          <label className="block">
            <span className="text-muted-foreground mb-1.5 block text-[13px]">
              Pickup date
            </span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11"
            />
          </label>
          <Button
            className="h-12 w-full"
            disabled={!origin || busy}
            onClick={runSearch}
          >
            {busy ? "Searching…" : "Search"}
          </Button>
          {origin && dest ? (
            <Button
              variant="secondary"
              className="h-11 w-full"
              disabled={saveLane.isPending}
              onClick={() =>
                saveLane.mutate({
                  originLabel: `${origin.city}, ${origin.region}`,
                  destLabel: `${dest.city}, ${dest.region}`,
                  originLat: origin.latitude,
                  originLng: origin.longitude,
                  destLat: dest.latitude,
                  destLng: dest.longitude,
                  equipmentTypes:
                    equipment === "ANY"
                      ? ["DRY_VAN", "REEFER", "FLATBED"]
                      : [equipment],
                  radiusMeters: 80_000,
                })
              }
            >
              {saveLane.isPending ? "Saving…" : "Save this lane"}
            </Button>
          ) : null}
          {savedMsg ? (
            <p className="text-[13px] text-lime">
              {savedMsg}{" "}
              <Link href="/freight/carrier/lanes" className="underline">
                Open
              </Link>
            </p>
          ) : null}
          {err ? (
            <p role="alert" className="text-destructive text-[13px]">
              {err}
            </p>
          ) : null}
        </aside>

        <section>
          {!results ? (
            <Empty>Set origin and search to see available loads.</Empty>
          ) : results.length === 0 ? (
            <Empty>Nothing matches this lane right now.</Empty>
          ) : (
            <ul className="space-y-2">
              {results.map((load) => (
                <li key={load.id}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/freight/carrier/loads/${load.id}`)
                    }
                    className="bg-card ring-border hover:bg-accent/30 flex w-full items-start justify-between gap-4 rounded-2xl p-4 text-left ring-1 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold">
                        {loadLaneLabel(load)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-[13px]">
                        {EQUIPMENT_LABEL[load.equipmentType]} ·{" "}
                        {load.totalWeight.toLocaleString()} lb ·{" "}
                        {formatMiles(load.distanceMeters)}
                        {load.deadheadMeters != null
                          ? ` · ${formatMiles(load.deadheadMeters)} DH`
                          : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[17px] font-semibold tabular-nums">
                        {formatMoneyOrDash(load.carrierRateMinor, load.currency)}
                      </p>
                      <p className="text-muted-foreground text-[12px] tabular-nums">
                        {formatRatePerMile(
                          load.carrierRateMinor,
                          load.distanceMeters,
                        )}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LocSearch
        field={locField}
        onClose={() => setLocField(null)}
        onSelect={(loc) => {
          const place = placeFromLocation(loc);
          if (locField === "origin") setOrigin(place);
          if (locField === "dest") setDest(place);
          setLocField(null);
        }}
      />
    </div>
  );
}
