/** Deterministic freight fixtures. */

export type FreightLoadCard = {
  id: string;
  origin: string;
  destination: string;
  rateLabel: string;
  distanceLabel: string;
  equipmentLabel: string;
  statusLabel: string;
};

export const EQUIPMENT = ["Dry van", "Reefer", "Flatbed", "Power only"] as const;

export const FREIGHT_LOADS: FreightLoadCard[] = [
  {
    id: "load-1",
    origin: "Ontario, CA",
    destination: "Phoenix, AZ",
    rateLabel: "$1,840",
    distanceLabel: "795 mi",
    equipmentLabel: "Dry van",
    statusLabel: "Posted",
  },
  {
    id: "load-2",
    origin: "Riverside, CA",
    destination: "Las Vegas, NV",
    rateLabel: "$980",
    distanceLabel: "228 mi",
    equipmentLabel: "Reefer",
    statusLabel: "Posted",
  },
];

export const SHIPMENT = {
  origin: "Ontario, CA · Dock 14",
  destination: "Phoenix, AZ · Dock 3",
  equipment: "Dry van",
  weight: "34,000 lb",
  rate: "$1,840.00",
  distance: "795 mi",
  eta: "12h 04m",
};

export const FREIGHT_QUOTE_LINES = [
  { label: "Linehaul", value: "$1,684.00" },
  { label: "Fuel surcharge", value: "$142.00" },
  { label: "Detention (est.)", value: "$14.00" },
];

export const CARRIER_LOAD = {
  id: "LC-48291",
  broker: "Lime Freight",
  origin: "Ontario, CA",
  destination: "Phoenix, AZ",
  pickup: "Aug 31 · 08:00",
  delivery: "Sep 1 · 16:30",
  rate: "$1,840",
  rpm: "$2.31/mi",
  equipment: "53' Dry van",
  weight: "34,000 lb",
  miles: 795,
  stops: 0,
};

export const FLEET_VEHICLES = [
  { id: "t1", unit: "Unit 104", plate: "8KJT402", status: "Available" },
  { id: "t2", unit: "Unit 207", plate: "7XYZ891", status: "On load" },
];

export const SAVED_LANES = [
  { id: "l1", origin: "Ontario, CA", destination: "Phoenix, AZ", loads: 12 },
  { id: "l2", origin: "LA", destination: "SF", loads: 4 },
];
