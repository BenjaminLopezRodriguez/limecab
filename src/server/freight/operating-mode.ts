/**
 * Freight operating mode. Default marketplace.
 * Broker helpers are stubs — do NOT bake Connect/broker payment assumptions.
 * Nothing here posts real payments.
 */

export const FREIGHT_OPERATING_MODES = [
  "marketplace",
  "broker",
  "hybrid",
] as const;

export type FreightOperatingMode = (typeof FREIGHT_OPERATING_MODES)[number];

export function getFreightOperatingMode(
  env: NodeJS.ProcessEnv = process.env,
): FreightOperatingMode {
  const raw = env.FREIGHT_OPERATING_MODE?.trim().toLowerCase();
  if (raw === "broker" || raw === "hybrid" || raw === "marketplace") {
    return raw;
  }
  return "marketplace";
}

/** True when broker-shaped flows may run. Stub gate only. */
export function isBrokerModeEnabled(
  mode: FreightOperatingMode = getFreightOperatingMode(),
): boolean {
  return mode === "broker" || mode === "hybrid";
}

/**
 * Stub: broker settlement path is not implemented.
 * Callers must not treat return as payment authority.
 */
export function brokerSettlementAllowed(): boolean {
  return false;
}
