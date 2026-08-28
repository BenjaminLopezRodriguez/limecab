/**
 * LimeCab's mocked marketplace.
 *
 * Client-side fixtures only: the catalogue, the geocoder, saved places, the
 * driver pool and payment methods. Dispatch itself is real — requesting,
 * matching and the trip lifecycle all live on the server now.
 */

import {
  createStaticGeocodeAdapter,
  type GeocodeAdapter,
} from "@/lib/service-app/geocode-adapter";
import type { MapPoint } from "@/lib/service-app/map-adapter";
import type { Location, Place } from "@/lib/service-app/services";
import type { RestStop } from "@/lib/limecab/rest-stops";
import { COURIER_SERVICE } from "@/lib/limecab/courier";
import { HELP_SERVICE } from "@/lib/limecab/help";
import {
  distanceMiles,
  estimateFare,
  tripMinutes,
  type Driver,
  type PaymentMethod,
  type Pickup,
  type Promo,
  type RideProduct,
} from "@/lib/limecab/domain";

/** Rider's device fix. Pickup starts here but is not pinned to it. */
export const CURRENT_LOCATION: Pickup = {
  address: "S Grand Ave & W 5th St, Los Angeles",
  latitude: 34.0505,
  longitude: -118.2551,
  meetingPoint: "Front entrance",
  followsDevice: true,
};

export const DRIVER_START: MapPoint = {
  latitude: 34.0611,
  longitude: -118.2401,
};

export const RIDE_PRODUCTS: RideProduct[] = [
  {
    id: "lime",
    name: "Lime",
    description: "Everyday ride",
    seats: 4,
    etaMinutes: 4,
    priceCents: 100,
    status: "available",
  },
  {
    id: "lime-xl",
    name: "Lime XL",
    description: "More space, up to 6",
    seats: 6,
    etaMinutes: 7,
    priceCents: 142,
    status: "available",
  },
  {
    id: "lime-comfort",
    name: "Lime Comfort",
    description: "Newer cars, quiet ride",
    seats: 4,
    etaMinutes: 6,
    priceCents: 128,
    status: "available",
  },
  {
    id: "lime-pool",
    name: "Lime Pool",
    description: "Share the trip, split the fare",
    seats: 2,
    etaMinutes: 9,
    priceCents: 72,
    status: "available",
  },
  {
    id: "lime-reserve",
    name: "Lime Reserve",
    description: "Book ahead",
    seats: 4,
    etaMinutes: 6,
    priceCents: 148,
    status: "available",
  },
];

/** Immediate tiers on the Home comparison list. Reserve is its own entry. */
export const IMMEDIATE_RIDE_PRODUCTS = RIDE_PRODUCTS.filter(
  (product) => product.id !== "lime-reserve",
);

/**
 * LA addresses the *fallback* geocoder knows. Not anybody's saved places —
 * a rider's Home and Work live in `limecab_saved_place`, keyed to their own
 * account. These are here so typing still resolves when Mapbox is down.
 */
const FALLBACK_ADDRESSES = [
  {
    id: "echo-park",
    address: "Echo Park Ave, Los Angeles",
    context: "Echo Park",
    latitude: 34.0782,
    longitude: -118.2606,
  },
  {
    id: "traction",
    address: "Traction Ave, Arts District",
    context: "Arts District",
    latitude: 34.0446,
    longitude: -118.2352,
  },
  {
    id: "pasadena",
    address: "E Colorado Blvd, Pasadena",
    context: "Pasadena",
    latitude: 34.1459,
    longitude: -118.1376,
  },
  {
    id: "union",
    address: "N Alameda St, Los Angeles",
    context: "Union Station",
    latitude: 34.0561,
    longitude: -118.2365,
  },
  {
    id: "big-bear",
    address: "Big Bear Blvd, Big Bear Lake",
    context: "Outside the service area",
    latitude: 34.2439,
    longitude: -116.9114,
  },
] as const;

/** Account settings the profile screens disclose. Display and device-local. */
export const RIDER_PREFERENCES = {
  quietRide: true,
  extraStops: false,
  waitOnArrival: true,
  defaultProductName: "Lime",
};

export const RIDER_SAFETY = {
  shareTrip: true,
  pickupPin: true,
  trustedContact: "Jordan M. ···· 0194",
};

export const RIDER_NOTIFICATIONS = {
  tripUpdates: true,
  driverMessages: true,
  promotions: false,
  emailReceipts: true,
};

export const DRIVER_DOCUMENTS = [
  {
    id: "license",
    label: "Driver’s license",
    detail: "Expires Nov 2028",
    status: "Verified",
  },
  {
    id: "insurance",
    label: "Insurance",
    detail: "Commercial policy",
    status: "Verified",
  },
  {
    id: "registration",
    label: "Vehicle registration",
    detail: "California",
    status: "Verified",
  },
  {
    id: "background",
    label: "Background check",
    detail: "Cleared 2024",
    status: "Cleared",
  },
] as const;

export const DRIVER_PAYOUT = {
  schedule: "Weekly on Friday",
  method: "Bank ···· 4821",
  instant: false,
};

export const DRIVER_PREFERENCES = {
  navigationVoice: true,
  acceptXl: true,
  longTrips: false,
  courierJobs: true,
};

/**
 * What LimeCab offers beyond a car right now. The unavailable ones are listed
 * rather than hidden, because "not here yet" is an answer and a blank tab is
 * not.
 */
export const LIMECAB_SERVICES = [
  {
    id: "ride",
    title: "Ride",
    description: "A car to your door",
    status: "available" as const,
  },
  {
    id: "reserve",
    title: "Reserve",
    description: "Book ahead",
    status: "available" as const,
  },
  COURIER_SERVICE,
  HELP_SERVICE,
  {
    id: "shop",
    title: "Shop",
    description: "A courier buys your list",
    status: "available" as const,
  },
  {
    id: "assist",
    title: "Assist",
    description: "Extra help getting in",
    status: "coming_soon" as const,
  },
];

/** Static LA fixtures the geocoder, voice parser, and Travel Mode share. */
export const GEOCODE_FIXTURES = [
  ...FALLBACK_ADDRESSES,
  {
    id: "lax",
    address: "LAX Terminal 4, Los Angeles",
    context: "Airport",
    latitude: 33.9416,
    longitude: -118.4085,
  },
  {
    id: "griffith",
    address: "Griffith Observatory, Los Angeles",
    context: "Los Feliz",
    latitude: 34.1184,
    longitude: -118.3004,
  },
  {
    id: "smpier",
    address: "Santa Monica Pier, Santa Monica",
    context: "Beach",
    latitude: 34.0094,
    longitude: -118.4973,
  },
  {
    id: "dodger",
    address: "Dodger Stadium, Los Angeles",
    context: "Elysian Park",
    latitude: 34.0739,
    longitude: -118.24,
  },
  {
    id: "plant-shop",
    address: "Sunset Plant Shop, Sunset Blvd, Los Angeles",
    context: "Snake plant · nursery",
    latitude: 34.0869,
    longitude: -118.2694,
  },
  {
    id: "butcher",
    address: "McCall's Meat & Fish, Los Feliz, Los Angeles",
    context: "Butcher",
    latitude: 34.0837,
    longitude: -118.3264,
  },
  {
    id: "gcm",
    address: "Grand Central Market, S Broadway, Los Angeles",
    context: "Coffee · downtown",
    latitude: 34.0508,
    longitude: -118.249,
  },
] as const;

/**
 * Shops a Lime Shop courier can buy a list at. Used when Mapbox Category
 * Search is unavailable, so the scene has rows instead of nothing — real LA
 * stores, never an invented chain.
 */
export const SHOP_PLACES: RestStop[] = [
  {
    address: "Grand Central Market, S Broadway, Los Angeles",
    shortName: "Grand Central Market",
    latitude: 34.0508,
    longitude: -118.249,
    category: "grocery",
  },
  {
    address: "Ralphs, 645 W 9th St, Los Angeles",
    shortName: "Ralphs",
    latitude: 34.0435,
    longitude: -118.2609,
    category: "supermarket",
  },
  {
    address: "Vons, 1430 S Fair Oaks Ave, Pasadena",
    shortName: "Vons",
    latitude: 34.1288,
    longitude: -118.1497,
    category: "supermarket",
  },
  {
    address: "Trader Joe's, 610 S Arroyo Pkwy, Pasadena",
    shortName: "Trader Joe's",
    latitude: 34.1385,
    longitude: -118.1489,
    category: "grocery",
  },
  {
    address: "CVS Pharmacy, 1533 N Lake Ave, Pasadena",
    shortName: "CVS Pharmacy",
    latitude: 34.1618,
    longitude: -118.1316,
    category: "pharmacy",
  },
  {
    address: "Walgreens, 1201 S Baldwin Ave, Arcadia",
    shortName: "Walgreens",
    latitude: 34.1195,
    longitude: -118.0512,
    category: "pharmacy",
  },
  {
    address: "Superior Grocers, 5050 Rosemead Blvd, Temple City",
    shortName: "Superior Grocers",
    latitude: 34.0947,
    longitude: -118.0776,
    category: "grocery",
  },
];

/**
 * Places a driver can pause: coffee, and the highway rest areas on the roads
 * out of LA. Used when Mapbox is down, never as invented demand.
 */
export const REST_STOPS: RestStop[] = [
  {
    address: "Grand Central Market, S Broadway, Los Angeles",
    shortName: "Grand Central Market",
    latitude: 34.0508,
    longitude: -118.249,
    category: "coffee",
  },
  {
    address: "Intelligentsia Coffee, Sunset Blvd, Silver Lake",
    shortName: "Intelligentsia",
    latitude: 34.0836,
    longitude: -118.2736,
    category: "coffee",
  },
  {
    address: "Verve Coffee, Spring St, Downtown Los Angeles",
    shortName: "Verve",
    latitude: 34.047,
    longitude: -118.2495,
    category: "coffee",
  },
  {
    address: "Castaic Rest Area, I-5, Castaic",
    shortName: "Castaic Rest Area",
    latitude: 34.492,
    longitude: -118.612,
    category: "rest_area",
  },
  {
    address: "Gorman Rest Area, I-5, Gorman",
    shortName: "Gorman Rest Area",
    latitude: 34.794,
    longitude: -118.852,
    category: "rest_area",
  },
  {
    address: "Conejo Pass vista, US-101, Thousand Oaks",
    shortName: "Conejo Pass",
    latitude: 34.185,
    longitude: -118.883,
    category: "rest_area",
  },
];

const TYPICAL_WAIT = `usually ${RIDE_PRODUCTS[0]!.etaMinutes} min`;

/** Curated spots for Travel Mode. Same booking chain as Saved places. */
export const TRAVEL_SPOTS: Place[] = [
  {
    id: "lax",
    label: "LAX Terminal 4",
    address: "LAX Terminal 4, Los Angeles",
    latitude: 33.9416,
    longitude: -118.4085,
    source: "saved",
    hint: TYPICAL_WAIT,
  },
  {
    id: "griffith",
    label: "Griffith Observatory",
    address: "Griffith Observatory, Los Angeles",
    latitude: 34.1184,
    longitude: -118.3004,
    source: "saved",
    hint: TYPICAL_WAIT,
  },
  {
    id: "smpier",
    label: "Santa Monica Pier",
    address: "Santa Monica Pier, Santa Monica",
    latitude: 34.0094,
    longitude: -118.4973,
    source: "saved",
    hint: TYPICAL_WAIT,
  },
  {
    id: "dodger",
    label: "Dodger Stadium",
    address: "Dodger Stadium, Los Angeles",
    latitude: 34.0739,
    longitude: -118.24,
    source: "saved",
    hint: TYPICAL_WAIT,
  },
];

export const geocodeAdapter: GeocodeAdapter = {
  ...createStaticGeocodeAdapter([...GEOCODE_FIXTURES]),
  async reverse(latitude, longitude) {
    const dropped: Location = {
      address: "Pinned location",
      latitude,
      longitude,
    };
    const candidates: Location[] = [
      CURRENT_LOCATION,
      ...FALLBACK_ADDRESSES.map((entry) => ({
        address: entry.address,
        latitude: entry.latitude,
        longitude: entry.longitude,
      })),
      {
        address: "LAX Terminal 4, Los Angeles",
        latitude: 33.9416,
        longitude: -118.4085,
      },
      {
        address: "Griffith Observatory, Los Angeles",
        latitude: 34.1184,
        longitude: -118.3004,
      },
      {
        address: "Santa Monica Pier, Santa Monica",
        latitude: 34.0094,
        longitude: -118.4973,
      },
      {
        address: "Dodger Stadium, Los Angeles",
        latitude: 34.0739,
        longitude: -118.24,
      },
    ];
    let nearest: Location | null = null;
    let nearestMiles = Infinity;
    for (const candidate of candidates) {
      if (candidate.latitude == null || candidate.longitude == null) continue;
      const miles = distanceMiles(dropped, candidate);
      if (miles < nearestMiles) {
        nearestMiles = miles;
        nearest = candidate;
      }
    }
    if (nearest && nearestMiles < 0.25) {
      return { address: nearest.address, latitude, longitude };
    }
    return dropped;
  },
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: "visa", label: "Personal", detail: "Visa ···· 4412", kind: "card" },
  { id: "amex", label: "Work", detail: "Amex ···· 1008", kind: "card" },
  {
    id: "wallet",
    label: "LimeCab Cash",
    detail: "$12.00 balance",
    kind: "wallet",
  },
];

export const AVAILABLE_PROMO: Promo = {
  code: "FIRST5",
  label: "First ride credit",
  amountCents: 500,
};

export const DRIVER_POOL: Driver[] = [
  {
    id: "maya",
    name: "Maya",
    rating: 4.94,
    vehicle: {
      make: "Toyota",
      model: "Prius",
      color: "Slate",
      plate: "8XKR112",
    },
  },
  {
    id: "dev",
    name: "Devon",
    rating: 4.89,
    vehicle: { make: "Kia", model: "Niro", color: "White", plate: "6PLT884" },
  },
  {
    id: "rio",
    name: "Rio",
    rating: 4.97,
    vehicle: { make: "Toyota", model: "Camry", color: "Black", plate: "7LIME22" },
  },
  {
    id: "jules",
    name: "Jules",
    rating: 4.91,
    vehicle: { make: "Chevy", model: "Bolt", color: "Silver", plate: "4CAB901" },
  },
];

export function estimateTrip(pickup: Location, destination: Location) {
  const miles = distanceMiles(pickup, destination);
  return { miles, minutes: tripMinutes(miles) };
}

export function quoteFor(
  product: RideProduct,
  pickup: Location,
  destination: Location,
) {
  const { miles, minutes } = estimateTrip(pickup, destination);
  return { fare: estimateFare(product, miles, minutes), miles, minutes };
}

/** Linear interpolation between two points — the mocked vehicle track. */
export function lerpPoint(a: MapPoint, b: MapPoint, t: number): MapPoint {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * clamped,
    longitude: a.longitude + (b.longitude - a.longitude) * clamped,
  };
}
