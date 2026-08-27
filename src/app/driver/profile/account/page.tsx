import { redirect } from "next/navigation";

import {
  DriverSubpage,
  ProfileNote,
  ProfileSection,
  ProfileValueRow,
} from "@/components/limecab/profile";
import { auth } from "@/server/auth";
import { api } from "@/trpc/server";

export default async function DriverAccountPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { driver, completedTrips } = await api.driver.me();
  if (!driver) redirect("/driver/profile");

  const rating = (driver.ratingHundredths / 100).toFixed(2);
  const tripsLabel =
    completedTrips === 1
      ? "1 completed trip"
      : `${completedTrips} completed trips`;

  return (
    <DriverSubpage
      backHref="/driver/profile"
      backLabel="Back to profile"
      title="Driver details"
    >
      <ProfileSection tone="driver">
        <ProfileValueRow label="Name" value={driver.name} />
        <ProfileValueRow
          label="Email"
          value={session.user.email ?? "Not on file"}
        />
        <ProfileValueRow label="Rating" value={rating} />
        <ProfileValueRow label="Trips" value={tripsLabel} />
        <ProfileValueRow
          label="Status"
          value={driver.available ? "Online" : "Off duty"}
        />
      </ProfileSection>
      <ProfileNote>
        Your name is what riders see at the curb. Go online from the inbox when
        you’re ready for requests.
      </ProfileNote>
    </DriverSubpage>
  );
}
