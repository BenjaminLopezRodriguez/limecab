import Link from "next/link";
import { redirect } from "next/navigation";
import { StarIcon } from "@hugeicons/core-free-icons";

import { Button } from "@/components/ui/button";
import {
  ProfileHero,
  ProfileLinkRow,
  ProfileSection,
  SignOutLink,
  VehicleCard,
} from "@/components/limecab/profile";
import { formatMoney } from "@/lib/service-app/services";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { driver, completedTrips, weekCents } = await api.driver.me();

  if (!driver) {
    return (
      <div className="mt-2">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">
          Your driver profile
        </h1>
        <p className="text-muted-foreground mt-2 text-[15px]">
          Register first — riders need a name and a car before you can go
          online.
        </p>
        <Button
          size="lg"
          className="mt-7 h-16 w-full text-[17px]"
          render={<Link href="/driver" />}
        >
          Go register
        </Button>
      </div>
    );
  }

  const rating = (driver.ratingHundredths / 100).toFixed(2);
  const since = `Driving since ${driver.createdAt.getFullYear()}`;
  const tripsLabel =
    completedTrips === 1 ? "1 trip" : `${completedTrips} trips`;

  return (
    <div className="mt-2">
      <ProfileHero
        name={driver.name}
        headingClassName="font-sans text-3xl font-semibold tracking-[-0.03em]"
        facts={[
          { icon: StarIcon, label: rating, iconClassName: "text-lime" },
          { label: tripsLabel },
          { label: since },
        ]}
      />

      <div className="mt-6">
        <VehicleCard
          href="/driver/profile/vehicle"
          make={driver.vehicleMake}
          model={driver.vehicleModel}
          color={driver.vehicleColor}
          plate={driver.vehiclePlate}
        />
      </div>

      <ProfileSection tone="driver" title="Account">
        <ProfileLinkRow
          href="/driver/profile/account"
          label="Driver details"
          value={session.user.email ?? driver.name}
        />
        <ProfileLinkRow
          href="/driver/profile/documents"
          label="Documents"
          value="Verified"
        />
        <ProfileLinkRow
          href="/driver/profile/earnings"
          label="Earnings"
          value={formatMoney(weekCents)}
        />
      </ProfileSection>

      <ProfileSection tone="driver" title="On the road">
        <ProfileLinkRow
          href="/driver/profile/preferences"
          label="Driving preferences"
        />
        <ProfileLinkRow href="/driver/profile/safety" label="Safety" />
      </ProfileSection>

      <ProfileSection tone="driver">
        <ProfileLinkRow href="/driver/profile/help" label="Help" />
      </ProfileSection>

      <SignOutLink />
    </div>
  );
}
