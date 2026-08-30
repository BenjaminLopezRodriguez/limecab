"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { asLoadCard, freight } from "@/components/freight/freight-api";
import { ShipmentList } from "@/components/freight/freight-parts";

/** Desk list for shipper — paired with New move compose at /freight. */
export function FreightShipperShipments() {
  const router = useRouter();
  const shipments = freight.myShipments.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <div className="max-w-2xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-[-0.03em]">
            Shipments
          </h1>
          <p className="text-muted-foreground mt-1 text-[15px]">
            Active and recent moves on this account.
          </p>
        </div>
        <Link
          href="/freight"
          className="text-[13px] font-semibold underline-offset-2 hover:underline"
        >
          New move
        </Link>
      </div>

      <div className="mt-6">
        <ShipmentList
          loads={shipments.data?.map(asLoadCard)}
          loading={shipments.isLoading}
          error={shipments.error}
          empty="No shipments yet. Start a new move to get a quote."
          onSelect={(id) => router.push(`/freight/shipments/${id}`)}
        />
      </div>
    </div>
  );
}
