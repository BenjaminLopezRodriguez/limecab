import type { ReactNode } from "react";

import { FreightCarrierGate } from "@/components/freight/carrier/freight-carrier-gate";
import { FreightPortalShell } from "@/components/freight/carrier/freight-portal-shell";

/**
 * Carrier desk — Search / Saved Lanes / My Loads / Fleet.
 * Dispatch work, desktop-first. Driving a booked load happens on `/driver`.
 */
export default function FreightCarrierLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <FreightPortalShell>
      <FreightCarrierGate>{children}</FreightCarrierGate>
    </FreightPortalShell>
  );
}
