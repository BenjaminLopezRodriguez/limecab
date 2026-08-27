import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import { formatTripWhen, productLabel } from "@/lib/limecab/format";
import { DRIVER_PAYOUT } from "@/lib/limecab/mock";
import { formatMoney } from "@/lib/service-app/services";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverEarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { driver } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  const earnings = await api.driver.earnings();

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Earnings"
    >
      <p className="text-5xl font-semibold tracking-[-0.04em] tabular-nums">
        {formatMoney(earnings.weekCents)}
      </p>
      <p className="text-muted-foreground mt-1 text-[15px]">This week</p>
      <p className="mt-2 text-[17px] font-medium tabular-nums">
        {formatMoney(earnings.todayCents)}{" "}
        <span className="text-muted-foreground font-normal">today</span>
      </p>

      <ProfileSection tone="driver" title="Trips">
        {earnings.trips.length === 0 ? (
          <p className="text-muted-foreground px-4 py-5 text-sm">
            Completed trips show up here with the fare you collected.
          </p>
        ) : (
          earnings.trips.map((trip) => (
            <div key={trip.id} className="flex min-h-16 items-start gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium tracking-tight">
                  {trip.destinationAddress}
                </p>
                <p className="text-muted-foreground text-sm">
                  {productLabel(trip.productId)}
                  {trip.completedAt
                    ? ` · ${formatTripWhen(trip.completedAt)}`
                    : null}
                </p>
                <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                  Fare {formatMoney(trip.baseCents)} · Distance{" "}
                  {formatMoney(trip.distanceCents)} · Time{" "}
                  {formatMoney(trip.timeCents)} · Booking{" "}
                  {formatMoney(trip.bookingCents)}
                </p>
              </div>
              <p className="shrink-0 text-[15px] font-semibold tabular-nums">
                {formatMoney(trip.totalCents)}
              </p>
            </div>
          ))
        )}
      </ProfileSection>

      <ProfileSection tone="driver" title="Payout">
        <ProfileValueRow label="Schedule" value={DRIVER_PAYOUT.schedule} />
        <ProfileValueRow label="Method" value={DRIVER_PAYOUT.method} />
        <SettingSwitch
          label="Instant pay"
          description="Cash out after each trip for a small fee. Weekly payouts stay free."
          defaultChecked={DRIVER_PAYOUT.instant}
        />
      </ProfileSection>
      <ProfileNote>
        Totals are the trip fares you completed. Weekly payouts land Friday.
        Instant pay is listed so you can see the option; it isn’t processed here
        yet.
      </ProfileNote>
    </DriverSubpage>
  );
}
