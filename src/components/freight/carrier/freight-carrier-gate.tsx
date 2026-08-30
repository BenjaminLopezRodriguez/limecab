"use client";

import Link from "next/link";

import { freight } from "@/components/freight/freight-api";
import { Empty } from "@/components/freight/freight-parts";

/**
 * Carrier routes require at least one carrier membership.
 * Seed Lime Test Carrier (or ask ops) before the board is usable.
 */
export function FreightCarrierGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const perspective = freight.perspective.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (perspective.isLoading) {
    return (
      <div className="mt-6" aria-busy="true">
        <div className="bg-muted h-40 w-full animate-pulse rounded-3xl" />
        <span className="sr-only">Checking carrier membership</span>
      </div>
    );
  }

  if (perspective.error) {
    return (
      <p role="alert" className="mt-6 text-[15px]">
        Couldn’t load carrier access. {perspective.error.message}
      </p>
    );
  }

  if (!perspective.data?.carrierMemberships.length) {
    return (
      <div className="space-y-4">
        <Empty>
          No carrier membership on this account. Seed Lime Test Carrier, or
          open the fleet hub to invite drivers and manage access.
        </Empty>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[14px] font-medium">
          <Link
            href="/partner/fleets"
            className="underline-offset-2 hover:underline"
          >
            Fleet hub
          </Link>
          <Link href="/freight" className="underline-offset-2 hover:underline">
            Ship
          </Link>
          <Link
            href="/freight/driver"
            className="underline-offset-2 hover:underline"
          >
            Freight app
          </Link>
        </nav>
      </div>
    );
  }

  return <>{children}</>;
}
