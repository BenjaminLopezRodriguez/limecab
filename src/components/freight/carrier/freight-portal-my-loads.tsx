"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { freight, loadLaneLabel } from "@/components/freight/freight-api";
import { Empty, formatMoneyOrDash } from "@/components/freight/freight-parts";
import { cn } from "@/lib/utils";

type Seg = "needs_driver" | "upcoming" | "in_progress" | "done";

/**
 * My Loads — unassigned (needs driver) surfaces first, per Uber portal guide.
 */
export function FreightPortalMyLoads() {
  const router = useRouter();
  const [seg, setSeg] = useState<Seg>("needs_driver");
  const myLoads = freight.myLoads.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const groups = useMemo(() => {
    const rows = myLoads.data ?? [];
    const needs = rows.filter(
      (l) => l.status === "BOOKED" && !l.assignedDriverUserId,
    );
    const upcoming = rows.filter(
      (l) =>
        l.status === "DRIVER_ASSIGNED" ||
        (l.status === "BOOKED" && l.assignedDriverUserId),
    );
    const inProgress = rows.filter((l) =>
      [
        "EN_ROUTE_TO_PICKUP",
        "AT_PICKUP",
        "LOADING",
        "IN_TRANSIT",
        "AT_DELIVERY",
        "UNLOADING",
        "DELIVERED",
        "POD_PENDING",
      ].includes(l.status),
    );
    const done = rows.filter((l) =>
      ["COMPLETED", "CANCELED", "REJECTED"].includes(l.status),
    );
    return { needs_driver: needs, upcoming, in_progress: inProgress, done };
  }, [myLoads.data]);

  const list = groups[seg];

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold tracking-[-0.03em] md:text-3xl">
        My Loads
      </h1>
      <p className="text-muted-foreground mt-1 text-[15px]">
        Booked freight. Loads without a driver sort to the top.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["needs_driver", `Needs driver (${groups.needs_driver.length})`],
            ["upcoming", `Upcoming (${groups.upcoming.length})`],
            ["in_progress", `In progress (${groups.in_progress.length})`],
            ["done", `Completed (${groups.done.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSeg(id)}
            className={cn(
              "rounded-full px-3.5 py-2 text-[13px] font-semibold",
              seg === id
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {myLoads.isLoading ? (
        <div className="bg-muted mt-6 h-24 animate-pulse rounded-2xl" />
      ) : list.length === 0 ? (
        <Empty className="mt-6">
          {seg === "needs_driver"
            ? "No loads waiting for a driver."
            : "Nothing in this list."}
        </Empty>
      ) : (
        <ul className="mt-6 space-y-2">
          {list.map((load) => (
            <li key={load.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/freight/carrier/loads/${load.id}`)
                }
                className="bg-card ring-border hover:bg-accent/30 flex w-full items-center justify-between gap-4 rounded-2xl p-4 text-left ring-1"
              >
                <div>
                  <p className="text-[16px] font-semibold">
                    {loadLaneLabel(load)}
                  </p>
                  <p className="text-muted-foreground mt-1 text-[13px]">
                    {load.status.replaceAll("_", " ")}
                    {!load.assignedDriverUserId && load.status === "BOOKED"
                      ? " · Needs driver"
                      : ""}
                  </p>
                </div>
                <p className="text-[15px] font-semibold tabular-nums">
                  {formatMoneyOrDash(load.carrierRateMinor, load.currency)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
