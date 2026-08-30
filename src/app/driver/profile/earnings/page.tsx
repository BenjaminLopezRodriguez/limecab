import { redirect } from "next/navigation";

import { SettingSwitch } from "@/components/limecab/profile-settings";
import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import {
  ChoiceLinkRow,
  ChoiceList,
} from "@/components/service-app/choice-list";
import { formatTripWhen, productLabel } from "@/lib/limecab/format";
import { DRIVER_PAYOUT } from "@/lib/limecab/mock";
import { formatMoney, obscureAddress } from "@/lib/service-app/services";
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

      <section className="mt-8">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          Trips
        </h2>
        {earnings.trips.length === 0 ? (
          <p className="bg-secondary/60 text-muted-foreground mt-3 rounded-3xl px-4 py-5 text-sm leading-relaxed">
            Completed trips show up here with the fare you collected.
          </p>
        ) : (
          <ChoiceList className="mt-3">
            {earnings.trips.map((trip) => {
              const area = obscureAddress(trip.destinationAddress);
              const when = trip.completedAt ?? trip.requestedAt;
              return (
                <ChoiceLinkRow
                  key={trip.id}
                  href={`/driver/profile/earnings/${trip.id}`}
                  aria-label={`${area}. ${productLabel(trip.productId)}. ${formatTripWhen(when)}. ${formatMoney(trip.totalCents)}.`}
                >
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-semibold tracking-tight">
                        {area}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm tabular-nums">
                        {productLabel(trip.productId)} · {formatTripWhen(when)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[17px] font-semibold tabular-nums">
                      {formatMoney(trip.totalCents)}
                    </p>
                  </div>
                </ChoiceLinkRow>
              );
            })}
          </ChoiceList>
        )}
      </section>

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
