import { DriverSubpage, ProfileSection, ProfileValueRow } from "@/components/limecab/profile";
import { formatMoney } from "@/lib/service-app/services";

export default function PartnerPlacesEarningsPage() {
  const weekCents = 10_300;
  const todayCents = 8500;

  return (
    <DriverSubpage
      backHref="/partner/places/app/account"
      backLabel="Back to account"
      title="Earnings"
    >
      <p className="text-5xl font-semibold tracking-[-0.04em] tabular-nums">
        {formatMoney(weekCents)}
      </p>
      <p className="text-muted-foreground mt-1 text-[15px]">This week</p>
      <p className="mt-2 text-[17px] font-medium tabular-nums">
        {formatMoney(todayCents)}{" "}
        <span className="text-muted-foreground font-normal">today</span>
      </p>

      <ProfileSection tone="driver" title="Payout">
        <ProfileValueRow label="Schedule" value="Weekly on Friday" />
        <ProfileValueRow label="Method" value="Bank ···· 4821" />
      </ProfileSection>

      <section className="mt-8">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-[0.14em] uppercase">
          Trips
        </h2>
        <p className="bg-secondary/60 text-muted-foreground mt-3 rounded-3xl px-4 py-5 text-sm leading-relaxed">
          Completed bookings show up here with the fare you collected — same
          shape as driver earnings.
        </p>
      </section>
    </DriverSubpage>
  );
}
