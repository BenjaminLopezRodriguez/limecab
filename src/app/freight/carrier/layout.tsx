import type { ReactNode } from "react";

import { FreightCarrierGate } from "@/components/freight/carrier/freight-carrier-gate";
import { FreightPortalShell } from "@/components/freight/carrier/freight-portal-shell";

/**
 * Carrier web portal — Search / Saved Lanes / My Loads / Fleet Management.
 * Desktop-first (Uber Freight portal shape). Mobile app: /freight/driver.
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
