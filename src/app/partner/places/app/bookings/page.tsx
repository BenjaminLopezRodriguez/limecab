import { DriverSubpage } from "@/components/limecab/profile";
import {
  ChoiceList,
  ChoiceStaticRow,
} from "@/components/service-app/choice-list";

const MOCK_BOOKINGS = [
  {
    id: "bk_1",
    listing: "Boardroom A",
    when: "Today · 2:00 PM",
    product: "Spaces · meeting room",
    total: "$85.00",
  },
  {
    id: "bk_2",
    listing: "Lot 7 — Dodger Stadium",
    when: "Tomorrow · all day",
    product: "Station · parking",
    total: "$18.00",
  },
];

export default function PartnerPlacesBookingsPage() {
  return (
    <DriverSubpage
      backHref="/partner/places/app"
      backLabel="Back to desk"
      title="Bookings"
    >
      <p className="text-muted-foreground text-[15px] leading-relaxed">
        Incoming Spaces and Station reservations land here — one at a time,
        like a driver offer.
      </p>

      <section className="mt-8">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          Upcoming
        </h2>
        {MOCK_BOOKINGS.length === 0 ? (
          <p className="bg-secondary/60 text-muted-foreground mt-3 rounded-3xl px-4 py-5 text-sm leading-relaxed">
            No bookings yet. Go live on the desk when your listings are ready.
          </p>
        ) : (
          <ChoiceList className="mt-3">
            {MOCK_BOOKINGS.map((booking) => (
              <ChoiceStaticRow key={booking.id}>
                <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold tracking-tight">
                      {booking.listing}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-sm">
                      {booking.product}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                      {booking.when}
                    </p>
                  </div>
                  <p className="shrink-0 text-[17px] font-semibold tabular-nums">
                    {booking.total}
                  </p>
                </div>
              </ChoiceStaticRow>
            ))}
          </ChoiceList>
        )}
      </section>
    </DriverSubpage>
  );
}
