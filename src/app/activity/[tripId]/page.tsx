import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  ProfileLinkRow,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
  TabSubpage,
} from "@/components/limecab/profile";
import { findBookableProduct, isCourierProduct } from "@/lib/limecab/courier";
import { formatTripWhen, tripStatusLabel } from "@/lib/limecab/format";
import { RIDE_PRODUCTS } from "@/lib/limecab/mock";
import {
  isShopTrip,
  parseShopList,
  shopItemLine,
} from "@/lib/limecab/shop-list";
import { formatMoney } from "@/lib/service-app/services";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/activity");

  const { tripId } = await params;
  let trip;
  try {
    trip = await api.trip.get({ id: tripId });
  } catch {
    notFound();
  }

  const courier = isCourierProduct(trip.productId);
  const shop = isShopTrip(trip.itemList);
  const shopItems = shop ? parseShopList(trip.itemList) : [];
  const product =
    findBookableProduct(trip.productId, RIDE_PRODUCTS)?.name ?? "Lime";
  const tickets = await api.trip.tickets({ tripId });
  const backHref = shop ? "/activity?tab=shop" : "/activity";
  const title = shop
    ? shopItems.map(shopItemLine).slice(0, 2).join(", ") || trip.pickupAddress
    : courier && trip.recipientName
      ? trip.recipientName
      : trip.destinationAddress;

  return (
    <TabSubpage
      backHref={backHref}
      backLabel="Back to activity"
      title={title}
    >
      <p className="text-muted-foreground -mt-4 text-sm tabular-nums">
        {formatTripWhen(trip.requestedAt)} · {shop ? "Shop" : product} ·{" "}
        {tripStatusLabel(trip.status, courier)}
      </p>

      {shopItems.length > 0 ? (
        <ProfileSection title="Cart">
          {shopItems.map((item, index) => (
            <ProfileValueRow
              key={`${item.label}-${index}`}
              label={shopItemLine(item)}
              value={item.note ?? "—"}
            />
          ))}
        </ProfileSection>
      ) : null}

      <ProfileSection title="Route">
        <ProfileValueRow
          label={shop ? "Store" : courier ? "Pick up" : "Pickup"}
          value={trip.pickupAddress}
        />
        <ProfileValueRow
          label={courier || shop ? "Drop-off" : "Destination"}
          value={trip.destinationAddress}
        />
      </ProfileSection>

      <ProfileSection title="Fare">
        <ProfileValueRow label="Base" value={formatMoney(trip.baseCents)} />
        <ProfileValueRow
          label={`Distance · ${trip.distanceMiles.toFixed(1)} mi`}
          value={formatMoney(trip.distanceCents)}
        />
        <ProfileValueRow
          label={`Time · ${trip.tripMinutes} min`}
          value={formatMoney(trip.timeCents)}
        />
        <ProfileValueRow label="Booking fee" value={formatMoney(trip.bookingCents)} />
        <ProfileValueRow label="Total" value={formatMoney(trip.totalCents)} />
      </ProfileSection>

      {trip.driver ? (
        <ProfileSection title={courier ? "Courier" : "Driver"}>
          <ProfileValueRow label="Name" value={trip.driver.name} />
          <ProfileValueRow
            label="Vehicle"
            value={`${trip.driver.vehicleColor} ${trip.driver.vehicleMake} ${trip.driver.vehicleModel}`}
          />
          <ProfileValueRow label="Plate" value={trip.driver.vehiclePlate} />
        </ProfileSection>
      ) : null}

      <ProfileSection title="Help with this trip">
        <ProfileLinkRow href={`/activity/${trip.id}/help`} label="Get support" />
      </ProfileSection>

      {tickets.length > 0 ? (
        <ProfileSection title="Your notes">
          {tickets.map((ticket) => (
            <ProfileValueRow
              key={ticket.id}
              label={ticket.topic.replace("_", " ")}
              value={ticket.status === "open" ? "Open" : "Closed"}
            />
          ))}
        </ProfileSection>
      ) : null}

      <Link
        href={shop ? "/?service=shop" : courier ? "/?service=courier" : "/"}
        className="ring-border focus-visible:ring-ring active:bg-accent mt-7 flex min-h-14 items-center justify-center rounded-full text-[15px] font-semibold tracking-tight ring-1 focus-visible:ring-2 focus-visible:outline-none"
      >
        {shop ? "Reorder" : "Rebook"}
      </Link>
      <ProfileNote>
        Support is always from the trip it belongs to. Open Get support to send
        a fare, lost-item, or safety note.
      </ProfileNote>
    </TabSubpage>
  );
}
