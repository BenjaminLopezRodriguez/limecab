"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

import { freight } from "@/components/freight/freight-api";
import { Empty, formatMoney } from "@/components/freight/freight-parts";

/**
 * Saved Lanes — recurring corridors; click runs search into results via Search
 * with prefilled coords (navigate to Search with query… for v1: search inline).
 */
export function FreightPortalLanes() {
  const router = useRouter();
  const utils = api.useUtils();
  const lanes = freight.listSavedLanes.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const deactivate = freight.deactivateLane.useMutation({
    onSuccess: () => void lanes.refetch(),
  });

  const runLane = async (lane: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    radiusMeters: number;
    equipmentTypes: string;
  }) => {
    let equipment: "DRY_VAN" | "REEFER" | "FLATBED" | undefined;
    try {
      const parsed = JSON.parse(lane.equipmentTypes) as string[];
      if (parsed.length === 1) equipment = parsed[0] as typeof equipment;
    } catch {
      /* ignore */
    }
    const hits = await utils.freight.searchLoads.fetch({
      originLat: lane.originLat,
      originLng: lane.originLng,
      destLat: lane.destLat,
      destLng: lane.destLng,
      radiusMeters: lane.radiusMeters,
      equipmentType: equipment,
    });
    if (hits[0]?.load.id) {
      router.push(`/freight/carrier/loads/${hits[0].load.id}`);
      return;
    }
    router.push("/freight/carrier");
  };

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        Saved Lanes
      </h1>
      <p className="text-muted-foreground mt-1 text-[15px]">
        Preferred corridors. Save from Search, then reopen matches here.
      </p>

      {lanes.isLoading ? (
        <div className="bg-muted mt-6 h-24 animate-pulse rounded-2xl" />
      ) : !lanes.data?.length ? (
        <Empty className="mt-6">
          No saved lanes. Search a lane and click “Save this lane.”
        </Empty>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl ring-1 ring-border">
          {lanes.data.map((lane) => (
            <li
              key={lane.id}
              className="bg-card flex flex-wrap items-center justify-between gap-3 px-4 py-4 first:rounded-t-2xl last:rounded-b-2xl"
            >
              <div>
                <p className="text-[16px] font-semibold tracking-tight">
                  {lane.originLabel}
                  <span className="text-muted-foreground font-normal"> → </span>
                  {lane.destLabel}
                </p>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                  Radius {(lane.radiusMeters / 1609.344).toFixed(0)} mi ·{" "}
                  {safeEquip(lane.equipmentTypes)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="h-10"
                  onClick={() => void runLane(lane)}
                >
                  Find loads
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-10"
                  disabled={deactivate.isPending}
                  onClick={() => deactivate.mutate({ laneId: lane.id })}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function safeEquip(raw: string) {
  try {
    return (JSON.parse(raw) as string[]).join(", ");
  } catch {
    return raw;
  }
}
