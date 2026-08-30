/** Freight domain enums. Pure types — no I/O. */

export const EQUIPMENT_TYPES = ["DRY_VAN", "REEFER", "FLATBED"] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const LOAD_MODES = ["FTL"] as const;
export type LoadMode = (typeof LOAD_MODES)[number];

export const BOOKING_MODES = ["INSTANT", "BID", "HYBRID"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const FREIGHT_ROLES = [
  "SHIPPER",
  "CARRIER_OWNER",
  "DISPATCHER",
  "DRIVER",
  "SYSTEM",
] as const;
export type FreightRole = (typeof FREIGHT_ROLES)[number];

export const CARRIER_MEMBER_ROLES = ["OWNER", "DISPATCHER", "DRIVER"] as const;
export type CarrierMemberRole = (typeof CARRIER_MEMBER_ROLES)[number];

export const FACILITY_TYPES = [
  "WAREHOUSE",
  "DISTRIBUTION_CENTER",
  "CROSS_DOCK",
  "YARD",
  "OTHER",
] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

export const STOP_TYPES = ["PICKUP", "DROPOFF"] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "ON_LOAD",
  "OUT_OF_SERVICE",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const WEIGHT_UNITS = ["LB"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export function isEquipmentType(v: string): v is EquipmentType {
  return (EQUIPMENT_TYPES as readonly string[]).includes(v);
}

export function isBookingMode(v: string): v is BookingMode {
  return (BOOKING_MODES as readonly string[]).includes(v);
}
