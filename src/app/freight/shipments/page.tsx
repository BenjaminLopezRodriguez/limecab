import { FreightShipperShell } from "@/components/freight/shipper/freight-shipper-shell";
import { FreightShipperShipments } from "@/components/freight/shipper/freight-shipper-shipments";

export default function FreightShipmentsPage() {
  return (
    <FreightShipperShell>
      <FreightShipperShipments />
    </FreightShipperShell>
  );
}
