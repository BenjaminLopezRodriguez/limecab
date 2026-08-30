import { PartnerPlacesApp } from "@/components/partner/partner-places-app";
import { auth } from "@/server/auth";

export default async function PartnerPlacesAppPage() {
  const session = await auth();
  const initial = (session?.user?.name ?? "P").charAt(0).toUpperCase();

  return <PartnerPlacesApp partnerInitial={initial} />;
}
