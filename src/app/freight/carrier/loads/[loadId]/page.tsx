import { FreightPortalLoadDetail } from "@/components/freight/carrier/freight-portal-load-detail";

export default async function FreightCarrierLoadDetailPage({
  params,
}: {
  params: Promise<{ loadId: string }>;
}) {
  const { loadId } = await params;
  return <FreightPortalLoadDetail loadId={loadId} />;
}
