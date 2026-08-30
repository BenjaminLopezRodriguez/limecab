import { FreightChrome } from "@/components/freight/freight-chrome";
import { FreightDriverApp } from "@/components/freight/driver/freight-driver-app";

/**
 * Freight mobile app — Book / My Loads / Drivers / Account.
 * Dispatcher desktop portal: /freight/carrier.
 */
export default function FreightDriverPage() {
  return (
    <FreightChrome product="driver" duty>
      <FreightDriverApp />
    </FreightChrome>
  );
}
