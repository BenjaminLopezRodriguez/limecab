/**
 * FreightPricingEngine — SIMULATED / DETERMINISTIC MOCK ONLY.
 *
 * Not a market rate. Not a broker quote. Not payment authority.
 * Label: pricingVersion `"mock-v1"`. Integer minor units only.
 */

import { money, type CurrencyCode } from "../limecab/money.ts";

import type { EquipmentType } from "./types";

const METERS_PER_MILE = 1609.344;

/** Simulated base + per-mile tuned so Ontario→Phoenix (~795 mi) ≈ $1840 carrier. */
const MOCK_BASE_MINOR = 25_000;
const MOCK_PER_MILE_MINOR = 200;
/** Shipper pays carrier + 12% platform/simulation markup. */
const SHIPPER_MARKUP_BPS = 1_200;

const EQUIPMENT_ADJ_BPS: Record<EquipmentType, number> = {
  DRY_VAN: 0,
  REEFER: 1_500,
  FLATBED: 1_000,
};

export type FreightPricingInput = {
  distanceMeters: number;
  equipmentType: EquipmentType;
  weightLb: number;
  pickupAt: Date;
};

export type FreightPricingComponents = {
  baseMinor: number;
  distanceMinor: number;
  equipmentAdjMinor: number;
  weightAdjMinor: number;
  /** Always 0 in mock-v1; reserved for later market signal. */
  marketAdjustmentMinor: number;
};

export type FreightPricingResult = {
  /** SIMULATED — not a real charge. */
  shipperAmountMinor: number;
  /** SIMULATED — not a real payable. */
  carrierRateMinor: number;
  currency: CurrencyCode;
  components: FreightPricingComponents;
  pricingVersion: "mock-v1";
  simulated: true;
};

export type FreightPricingEngine = {
  quote(input: FreightPricingInput): FreightPricingResult;
};

function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

function applyBps(amountMinor: number, bps: number): number {
  return Math.trunc((amountMinor * bps) / 10_000);
}

/**
 * Deterministic mock engine. Same inputs → same cents. No ML, no market feed.
 */
export const deterministicPricingEngine: FreightPricingEngine = {
  quote(input) {
    if (
      !Number.isFinite(input.distanceMeters) ||
      input.distanceMeters < 0
    ) {
      throw new RangeError("distanceMeters must be a non-negative finite number");
    }
    if (!Number.isFinite(input.weightLb) || input.weightLb < 0) {
      throw new RangeError("weightLb must be a non-negative finite number");
    }

    const miles = metersToMiles(input.distanceMeters);
    const wholeMiles = Math.trunc(miles);
    const fracMiles = miles - wholeMiles;
    // Fractional mile: round half-up in whole cents from per-mile rate.
    const distanceMinor =
      wholeMiles * MOCK_PER_MILE_MINOR +
      Math.round(fracMiles * MOCK_PER_MILE_MINOR);

    const baseMinor = MOCK_BASE_MINOR;
    // Weight: +1¢ per 100 lb over 40k (overweight hint). Integer only.
    const overweightHundreds = Math.max(
      0,
      Math.trunc((input.weightLb - 40_000) / 100),
    );
    const weightAdjMinor = overweightHundreds;

    const subtotal = baseMinor + distanceMinor + weightAdjMinor;
    const equipmentAdjMinor = applyBps(
      subtotal,
      EQUIPMENT_ADJ_BPS[input.equipmentType],
    );
    const carrierRateMinor = subtotal + equipmentAdjMinor;
    const shipperAmountMinor =
      carrierRateMinor + applyBps(carrierRateMinor, SHIPPER_MARKUP_BPS);

    // Force through money() so non-integers blow up here, not in ledger.
    money(carrierRateMinor, "USD");
    money(shipperAmountMinor, "USD");

    // pickupAt reserved for daypart — unused in mock-v1 (deterministic).
    void input.pickupAt;

    return {
      shipperAmountMinor,
      carrierRateMinor,
      currency: "USD",
      components: {
        baseMinor,
        distanceMinor,
        equipmentAdjMinor,
        weightAdjMinor,
        marketAdjustmentMinor: 0,
      },
      pricingVersion: "mock-v1",
      simulated: true,
    };
  },
};
