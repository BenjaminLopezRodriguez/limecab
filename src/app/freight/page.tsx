import { FreightShipperShell } from "@/components/freight/shipper/freight-shipper-shell";
import { FreightShipperApp } from "@/components/freight/shipper/freight-shipper-app";

export default function FreightPage() {
  return (
    <FreightShipperShell>
      <FreightShipperApp />
    </FreightShipperShell>
  );
}
