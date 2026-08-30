import type { ReactNode } from "react";

import { PartnerPlacesChrome } from "@/components/partner/partner-places-chrome";
import { auth } from "@/server/auth";

export default async function PartnerPlacesAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();
  const initial = (session?.user?.name ?? "P").charAt(0).toUpperCase();

  return (
    <PartnerPlacesChrome initial={initial}>{children}</PartnerPlacesChrome>
  );
}
