/**
 * Seeds Lime Freight demo actors + Ontario→Phoenix AVAILABLE load.
 * All simulated=true. Idempotent via stable ids.
 */
import { milesToMeters } from "@/lib/freight/economics";
import { deterministicPricingEngine } from "@/lib/freight/pricing";
import { db } from "@/server/db";
import {
  freightCarrierMembers,
  freightCarriers,
  freightFacilities,
  freightLoads,
  freightSavedLanes,
  freightStops,
  freightVehicles,
  users,
} from "@/server/db/schema";

const SEED_PREFIX = "seed_freight_";

const IDS = {
  shipper: `${SEED_PREFIX}shipper`,
  owner: `${SEED_PREFIX}owner`,
  dispatcher: `${SEED_PREFIX}dispatcher`,
  driver: `${SEED_PREFIX}driver`,
  carrier: `${SEED_PREFIX}carrier`,
  vehicle: `${SEED_PREFIX}vehicle_dv101`,
  ontario: `${SEED_PREFIX}facility_ontario`,
  phoenix: `${SEED_PREFIX}facility_phoenix`,
  longBeach: `${SEED_PREFIX}facility_longbeach`,
  vegas: `${SEED_PREFIX}facility_vegas`,
  loadOnPhx: `${SEED_PREFIX}load_ontario_phoenix`,
  loadLbVegas: `${SEED_PREFIX}load_lb_vegas`,
  laneLaPhx: `${SEED_PREFIX}lane_la_phoenix`,
} as const;

// Real-ish coords
const ONTARIO = {
  lat: 34.0633,
  lng: -117.6509,
  address: "2500 S Archibald Ave",
  city: "Ontario",
  region: "CA",
};
const PHOENIX = {
  lat: 33.4484,
  lng: -112.074,
  address: "4802 W Lower Buckeye Rd",
  city: "Phoenix",
  region: "AZ",
};
const LONG_BEACH = {
  lat: 33.7701,
  lng: -118.1937,
  address: "1200 Pier A Way",
  city: "Long Beach",
  region: "CA",
};
const VEGAS = {
  lat: 36.1699,
  lng: -115.1398,
  address: "3333 W Sunset Rd",
  city: "Las Vegas",
  region: "NV",
};

async function main() {
  await db
    .insert(users)
    .values([
      {
        id: IDS.shipper,
        name: "Lime Freight Shipper",
        email: "shipper@freight.limecab.test",
      },
      {
        id: IDS.owner,
        name: "Lime Carrier Owner",
        email: "owner@freight.limecab.test",
      },
      {
        id: IDS.dispatcher,
        name: "Lime Carrier Dispatcher",
        email: "dispatcher@freight.limecab.test",
      },
      {
        id: IDS.driver,
        name: "Lime Freight Driver",
        email: "driver@freight.limecab.test",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(freightCarriers)
    .values({
      id: IDS.carrier,
      name: "Lime Test Carrier",
      organizationName: "Lime Test Carrier LLC",
      simulated: true,
    })
    .onConflictDoNothing();

  await db
    .insert(freightCarrierMembers)
    .values([
      {
        id: `${SEED_PREFIX}member_owner`,
        carrierId: IDS.carrier,
        userId: IDS.owner,
        role: "OWNER",
      },
      {
        id: `${SEED_PREFIX}member_dispatcher`,
        carrierId: IDS.carrier,
        userId: IDS.dispatcher,
        role: "DISPATCHER",
      },
      {
        id: `${SEED_PREFIX}member_driver`,
        carrierId: IDS.carrier,
        userId: IDS.driver,
        role: "DRIVER",
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(freightVehicles)
    .values({
      id: IDS.vehicle,
      carrierId: IDS.carrier,
      unitNumber: "DV-101",
      equipmentType: "DRY_VAN",
      status: "AVAILABLE",
    })
    .onConflictDoNothing();

  await db
    .insert(freightFacilities)
    .values([
      {
        id: IDS.ontario,
        name: "Ontario CA Warehouse",
        type: "WAREHOUSE",
        address: ONTARIO.address,
        city: ONTARIO.city,
        region: ONTARIO.region,
        lat: ONTARIO.lat,
        lng: ONTARIO.lng,
        parking: true,
        restroom: true,
        scale: true,
        appointmentRequired: true,
      },
      {
        id: IDS.phoenix,
        name: "Phoenix AZ DC",
        type: "DISTRIBUTION_CENTER",
        address: PHOENIX.address,
        city: PHOENIX.city,
        region: PHOENIX.region,
        lat: PHOENIX.lat,
        lng: PHOENIX.lng,
        parking: true,
        restroom: true,
        scale: false,
        appointmentRequired: true,
      },
      {
        id: IDS.longBeach,
        name: "Long Beach Port Yard",
        type: "YARD",
        address: LONG_BEACH.address,
        city: LONG_BEACH.city,
        region: LONG_BEACH.region,
        lat: LONG_BEACH.lat,
        lng: LONG_BEACH.lng,
        parking: true,
        restroom: false,
        scale: false,
        appointmentRequired: false,
      },
      {
        id: IDS.vegas,
        name: "Las Vegas Cold Storage",
        type: "WAREHOUSE",
        address: VEGAS.address,
        city: VEGAS.city,
        region: VEGAS.region,
        lat: VEGAS.lat,
        lng: VEGAS.lng,
        parking: true,
        restroom: true,
        scale: true,
        appointmentRequired: true,
      },
    ])
    .onConflictDoNothing();

  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(14, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrow);
  tomorrowEnd.setUTCHours(18, 0, 0, 0);

  const onPhxDistanceMeters = Math.round(milesToMeters(795));
  const onPhxQuote = deterministicPricingEngine.quote({
    distanceMeters: onPhxDistanceMeters,
    equipmentType: "DRY_VAN",
    weightLb: 34_000,
    pickupAt: tomorrow,
  });

  await db
    .insert(freightLoads)
    .values({
      id: IDS.loadOnPhx,
      shipperUserId: IDS.shipper,
      status: "AVAILABLE",
      mode: "FTL",
      equipmentType: "DRY_VAN",
      commodity: "General merchandise",
      totalWeight: 34_000,
      weightUnit: "LB",
      pallets: 26,
      distanceMeters: onPhxDistanceMeters,
      estimatedDurationSec: 12 * 3600,
      shipperPriceMinor: onPhxQuote.shipperAmountMinor,
      carrierRateMinor: onPhxQuote.carrierRateMinor,
      currency: "USD",
      bookingMode: "INSTANT",
      simulated: true,
      quotedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(freightStops)
    .values([
      {
        id: `${SEED_PREFIX}stop_onphx_pu`,
        loadId: IDS.loadOnPhx,
        sequence: 1,
        type: "PICKUP",
        facilityId: IDS.ontario,
        address: ONTARIO.address,
        city: ONTARIO.city,
        region: ONTARIO.region,
        lat: ONTARIO.lat,
        lng: ONTARIO.lng,
        appointmentStart: tomorrow,
        appointmentEnd: tomorrowEnd,
        instructions: "Check in at gate 3",
      },
      {
        id: `${SEED_PREFIX}stop_onphx_do`,
        loadId: IDS.loadOnPhx,
        sequence: 2,
        type: "DROPOFF",
        facilityId: IDS.phoenix,
        address: PHOENIX.address,
        city: PHOENIX.city,
        region: PHOENIX.region,
        lat: PHOENIX.lat,
        lng: PHOENIX.lng,
        appointmentStart: new Date(tomorrow.getTime() + 14 * 3600_000),
        appointmentEnd: new Date(tomorrow.getTime() + 18 * 3600_000),
      },
    ])
    .onConflictDoNothing();

  const lbVegasDistanceMeters = Math.round(milesToMeters(270));
  const lbVegasPickup = new Date(tomorrow);
  lbVegasPickup.setUTCDate(lbVegasPickup.getUTCDate() + 1);
  const lbVegasQuote = deterministicPricingEngine.quote({
    distanceMeters: lbVegasDistanceMeters,
    equipmentType: "REEFER",
    weightLb: 28_000,
    pickupAt: lbVegasPickup,
  });

  await db
    .insert(freightLoads)
    .values({
      id: IDS.loadLbVegas,
      shipperUserId: IDS.shipper,
      status: "AVAILABLE",
      mode: "FTL",
      equipmentType: "REEFER",
      commodity: "Frozen foods",
      totalWeight: 28_000,
      weightUnit: "LB",
      pallets: 20,
      distanceMeters: lbVegasDistanceMeters,
      estimatedDurationSec: 5 * 3600,
      shipperPriceMinor: lbVegasQuote.shipperAmountMinor,
      carrierRateMinor: lbVegasQuote.carrierRateMinor,
      currency: "USD",
      bookingMode: "INSTANT",
      simulated: true,
      quotedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(freightStops)
    .values([
      {
        id: `${SEED_PREFIX}stop_lbvegas_pu`,
        loadId: IDS.loadLbVegas,
        sequence: 1,
        type: "PICKUP",
        facilityId: IDS.longBeach,
        address: LONG_BEACH.address,
        city: LONG_BEACH.city,
        region: LONG_BEACH.region,
        lat: LONG_BEACH.lat,
        lng: LONG_BEACH.lng,
        appointmentStart: lbVegasPickup,
        appointmentEnd: new Date(lbVegasPickup.getTime() + 4 * 3600_000),
      },
      {
        id: `${SEED_PREFIX}stop_lbvegas_do`,
        loadId: IDS.loadLbVegas,
        sequence: 2,
        type: "DROPOFF",
        facilityId: IDS.vegas,
        address: VEGAS.address,
        city: VEGAS.city,
        region: VEGAS.region,
        lat: VEGAS.lat,
        lng: VEGAS.lng,
        appointmentStart: new Date(lbVegasPickup.getTime() + 6 * 3600_000),
        appointmentEnd: new Date(lbVegasPickup.getTime() + 10 * 3600_000),
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(freightSavedLanes)
    .values({
      id: IDS.laneLaPhx,
      carrierId: IDS.carrier,
      originLabel: "Los Angeles, CA",
      destLabel: "Phoenix, AZ",
      originLat: 34.0522,
      originLng: -118.2437,
      destLat: PHOENIX.lat,
      destLng: PHOENIX.lng,
      equipmentTypes: JSON.stringify(["DRY_VAN", "REEFER"]),
      radiusMeters: 80_000,
      active: true,
    })
    .onConflictDoNothing();

  console.log(
    `seeded freight: carrier=${IDS.carrier} load Ontario→Phoenix carrierRateMinor=${onPhxQuote.carrierRateMinor} (simulated)`,
  );
}

await main();
process.exit(0);
