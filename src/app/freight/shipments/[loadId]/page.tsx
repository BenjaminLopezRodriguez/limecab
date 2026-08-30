import { FreightShipperShell } from "@/components/freight/shipper/freight-shipper-shell";
import { FreightShipperApp } from "@/components/freight/shipper/freight-shipper-app";

export default async function FreightShipmentPage({
  params,
}: {
  params: Promise<{ loadId: string }>;
}) {
  const { loadId } = await params;
  return (
    <FreightShipperShell>
      <FreightShipperApp loadId={loadId} />
    </FreightShipperShell>
  );
}
