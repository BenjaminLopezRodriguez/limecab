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
import { COURIER_SERVICE } from "@/lib/limecab/courier";
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
    status: "coming_soon",
  },
];

export const SAVED_PLACES: Place[] = [
  {
    id: "home",
    label: "Home",
    address: "Echo Park Ave, Los Angeles",
    latitude: 34.0782,
    longitude: -118.2606,
    source: "saved",
    hint: "Saved",
  },
  {
    id: "work",
    label: "Work",
    address: "Traction Ave, Arts District",
    latitude: 34.0446,
    longitude: -118.2352,
    source: "saved",
    hint: "Saved",
  },
  {
    id: "pasadena",
    label: "Pasadena",
    address: "E Colorado Blvd, Pasadena",
    latitude: 34.1459,
    longitude: -118.1376,
    source: "recent",
    hint: "Yesterday",
  },
  {
    id: "union",
    label: "Union Station",
    address: "N Alameda St, Los Angeles",
    latitude: 34.0561,
    longitude: -118.2365,
    source: "recent",
    hint: "Last week",
  },
  {
    id: "big-bear",
    label: "Big Bear Lake",
    address: "Big Bear Blvd, Big Bear Lake",
    latitude: 34.2439,
    longitude: -116.9114,
    source: "recent",
    hint: "Outside the service area",
  },
];

/** The rider's most recent completed trip. Mocked; a trips table replaces it. */
export const LAST_TRIP: Place = SAVED_PLACES.find((p) => p.id === "pasadena")!;

/** The signed-in rider. Invented — there is no auth in this build. */
export const RIDER = {
  name: "Ava",
  fullName: "Ava Moreno",
  since: "Member since 2024",
  rating: 4.91,
  ridesTaken: 128,
};

/** Completed trips, newest first. A trips table replaces this. */
export const TRIP_HISTORY = [
  {
    id: "t_9812",
    productName: "Lime",
    destination: "E Colorado Blvd, Pasadena",
    when: "Yesterday · 6:42 PM",
    totalCents: 3259,
    driverName: "Maya",
  },
  {
    id: "t_9744",
    productName: "Lime Comfort",
    destination: "LAX Terminal 4, Los Angeles",
    when: "Sat · 5:10 AM",
    totalCents: 6180,
    driverName: "Devon",
  },
  {
    id: "t_9701",
    productName: "Lime",
    destination: "Traction Ave, Arts District",
    when: "Thu · 9:03 AM",
    totalCents: 1424,
    driverName: "Priya",
  },
  {
    id: "t_9666",
    productName: "Lime XL",
    destination: "Dodger Stadium, Los Angeles",
    when: "Tue · 6:15 PM",
    totalCents: 4790,
    driverName: "Marcus",
  },
];

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
    status: "coming_soon" as const,
  },
  COURIER_SERVICE,
  {
    id: "assist",
    title: "Assist",
    description: "Extra help getting in",
    status: "coming_soon" as const,
  },
];

export const geocodeAdapter: GeocodeAdapter = {
  ...createStaticGeocodeAdapter([
    ...SAVED_PLACES.map((place) => ({
      id: place.id,
      address: place.address,
      context: place.label,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
    })),
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
  ]),
  async reverse(latitude, longitude) {
    const dropped: Location = {
      address: "Pinned location",
      latitude,
      longitude,
    };
    const candidates: Location[] = [
      CURRENT_LOCATION,
      ...SAVED_PLACES.flatMap((place) => {
        if (place.latitude == null || place.longitude == null) return [];
        return [
          {
            address: place.address,
            latitude: place.latitude,
            longitude: place.longitude,
          },
        ];
      }),
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
  { id: "wallet", label: "LimeCab Cash", detail: "$12.00 balance", kind: "wallet" },
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
];

/** Idle drivers shown as ambient context while matching. */
export const NEARBY_DRIVERS: MapPoint[] = [
  { latitude: 34.0546, longitude: -118.2489, kind: "marker" },
  { latitude: 34.0462, longitude: -118.2612, kind: "marker" },
  { latitude: 34.0578, longitude: -118.2603, kind: "marker" },
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
